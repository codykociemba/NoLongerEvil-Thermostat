/* 
OMAP Loader, a USB uploader application targeted at OMAP3 processors
Copyright (C) 2008 Martin Mueller <martinmm@pfump.org>
Copyright (C) 2014 Grant Hernandez <grant.h.hernandez@gmail.com>

This program is free software; you can redistribute it and/or
modify it under the terms of the GNU General Public License
as published by the Free Software Foundation; either version 2
of the License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program; if not, write to the Free Software
Foundation, Inc., 51 Franklin Street, Fifth Floor, Boston, MA  02110-1301, USA.
*/

#include <stdio.h>
#include <stdlib.h>
#include <stdint.h>
#include <stdarg.h>
#include <string.h>
#include <stdbool.h>

/* Reasons for the name change: this is a complete rewrite of 
   the unversioned omap3_usbload so to lower ambiguity the name was changed.
   The GPLv2 license specifies rewrites as derived work.
*/
#define PROG_NAME "OMAP Loader"
#define VERSION "1.0.0"

#if defined(__BYTE_ORDER__) && (__BYTE_ORDER__ == __ORDER_BIG_ENDIAN__)
# define OMAP_IS_BIG_ENDIAN
#endif

#ifdef OMAP_IS_BIG_ENDIAN
# include <arpa/inet.h>
#endif

#include <unistd.h> /* for usleep and friends */
#include <getopt.h>
#include <errno.h>
#include <libgen.h> /* for basename */

#include <libusb.h> /* the main event */

/* Device specific defines (OMAP) 
   Primary source: http://www.ti.com/lit/pdf/sprugn4 
   Section 26.4.5 "Peripheral Booting"
*/
#define OMAP_BASE_ADDRESS 0x40200000
#define OMAP_PERIPH_BOOT 0xF0030002
#define OMAP_VENDOR_ID 0x0451
#define OMAP_PRODUCT_ID 0xD00E
/* TODO: dynamically discover these endpoints */
#define OMAP_USB_BULK_IN 0x81
#define OMAP_USB_BULK_OUT 0x01
#define OMAP_ASIC_ID_LEN 69
#define OMAP_USB_MAX_XFER (4 * 1024)

#ifdef OMAP_IS_BIG_ENDIAN
# define cpu_to_le32(v) (((v & 0xff) << 24) | ((v & 0xff00) << 8) | \
    ((v & 0xff0000) >> 8) | ((v & 0xff000000) >> 24))
# define le32_to_cpu(v) cpu_to_le32(v)
#else
# define cpu_to_le32(v) (v)
# define le32_to_cpu(v) (v)
#endif

/* taken from x-loader/drivers/usb/usb.c
   All credit to Martin Mueller */
#define PACK4(a,b,c,d) (((d)<<24) | ((c)<<16) | ((b)<<8) | (a))
#define USBLOAD_CMD_FILE PACK4('U','S','B','s')      /* file size request */
#define USBLOAD_CMD_FILE_REQ PACK4('U','S','B','f')  /* file size resp */
#define USBLOAD_CMD_JUMP PACK4('U','S','B','j')      /* execute code here */
#define USBLOAD_CMD_ECHO_SZ PACK4('U','S','B','n')   /* file size confirm to */
#define USBLOAD_CMD_REPORT_SZ PACK4('U','S','B','o') /* confirm full file */
#define USBLOAD_CMD_MESSAGE PACK4('U','S','B','m')   /* debug message */

/* USB transfer characteristics */
#define USB_MAX_WAIT 60000
#define USB_TIMEOUT 10000
#define USB_MAX_TIMEOUTS (USB_MAX_WAIT/USB_TIMEOUT)

/* Datatypes
 */

/* stores the data and attributes of a file to upload in to memory */
struct file_upload
{
  size_t size;
  unsigned char * data;
  uint32_t addr;
  char * path;
  char * basename;
};

/* stores all of the arguments read in by getopt in main() */
struct arg_state
{
  struct file_upload ** files;
  int numFiles;
  uint32_t jumpTarget;
  uint16_t vendor, product;
};

/* Datatypes
 */

static int g_verbose = 0; 

/* Function Prototypes
 */

/* Poll for a USB device matching vendor:product and return the open handle */
libusb_device_handle *
omap_usb_open(libusb_context * ctx, uint16_t vendor, uint16_t product);

/* Grab the string from the specified index. Returns dynamic memory
 * which is caller freed */
unsigned char *
omap_usb_get_string(libusb_device_handle * handle, uint8_t idx);

bool omap_usb_read(libusb_device_handle * handle, unsigned char * data,
    int length, int * actualLength);
bool omap_usb_write(libusb_device_handle * handle, unsigned char * data,
    int length);

unsigned char * read_file(char * path, size_t * readamt);

/* process the argument list from main() */
int process_args(struct arg_state * args);

/* negotiate with the BootROM to transfer the first stage */
int transfer_first_stage(libusb_device_handle * handle,
    struct arg_state * args);

/* negotiate with the X-loader (expected) to transfer the other files */
int transfer_other_files(libusb_device_handle * handle,
    struct arg_state * args);

/* standard usage function */
void usage(char * exe);

void log_error(char * fmt, ...);
void log_info(char * fmt, ...);

/* Function Declarations
 */

libusb_device_handle *
omap_usb_open(libusb_context * ctx, uint16_t vendor, uint16_t product)
{
  libusb_device ** devlist;
  libusb_device_handle * handle;
  struct libusb_device_descriptor desc;

  ssize_t count, i;
  int ret;
  bool found = false;

  log_info("scanning for USB device matching %04hx:%04hx...\n",
      vendor, product);

  while(!found)
  {
    if((count = libusb_get_device_list(ctx, &devlist)) < 0) {
      log_error("failed to gather USB device list: %s\n",
          libusb_error_name(count));
      return NULL;
    }

    for(i = 0; i < count; i++)
    {
      if((ret = libusb_get_device_descriptor(devlist[i], &desc)) < 0) {
        log_error("failed to get USB device descriptor: %s\n",
            libusb_error_name(ret));
        libusb_free_device_list(devlist, 1);
        return NULL;
      }

      if(desc.idVendor == vendor && desc.idProduct == product)
      {
        if((ret = libusb_open(devlist[i], &handle)) < 0)
        {
          log_error("failed to open USB device %04hx:%04hx: %s\n",
              vendor, product, libusb_error_name(ret));
          libusb_free_device_list(devlist, 1);
          return NULL;
        }

        found = true;
        break;
      }
    }

    /* clean up our device list */
    libusb_free_device_list(devlist, 1);

    /* nothing found yet. have a 10ms nap */
    if(!found)
      usleep(10000);
  }

  /* grab the manufacturer and product strings for printing */
  unsigned char * mfgStr = omap_usb_get_string(handle, desc.iManufacturer);
  unsigned char * prodStr = omap_usb_get_string(handle, desc.iProduct);

  log_info("successfully opened %04hx:%04hx (", vendor, product);

  if(mfgStr)
  {
    fprintf(stdout, prodStr ? "%s " : "%s", mfgStr);
    free(mfgStr);
  }

  if(prodStr)
  {
    fprintf(stdout, "%s", prodStr);
    free(prodStr);
  }

  fprintf(stdout, ")\n");

  return handle;
}

unsigned char *
omap_usb_get_string(libusb_device_handle * handle, uint8_t idx)
{
  unsigned char * data = NULL;
  int len = 0;
  int ret = 0;

  if(!handle)
    return NULL;

  while(true)
  {
    if(!len || ret < 0)
    {
      len += 256;
      data = realloc(data, len);

      if(!data)
        return NULL;
    }

    ret = libusb_get_string_descriptor_ascii(handle, idx, data, len);

    /* we can still recover... */
    if(ret < 0)
    {
      if(ret == LIBUSB_ERROR_INVALID_PARAM)
        continue; /* try again with an increased size */

      log_error("failed to lookup string index %hhu: %s\n", 
          idx, libusb_error_name(ret));
      
      /* unrecoverable */
      free(data);
      return NULL;
    }
    /* we got something! */
    else
      break;
  } 

  return data;
}

unsigned char * read_file(char * path, size_t * readamt)
{
  FILE * fp = fopen(path, "rb");

  if(!fp)
  {
    log_error("failed to open file \'%s\': %s\n", path, strerror(errno));
    return NULL;
  }

  unsigned char * data = NULL;
  size_t allocSize = 0;
  size_t iter = 0;

  while(1)
  {
    if(iter >= allocSize)
    {
      allocSize += 1024;
      data = realloc(data, allocSize);

      if(!data)
        return NULL;
    }

    size_t readSize = allocSize - iter;
    size_t ret = fread(data+iter, sizeof(unsigned char), readSize, fp);

    iter += ret;

    if(ret != readSize)
    {
      if(feof(fp))
      {
        break;
      }
      else if(ferror(fp))
      {
        log_error("error file reading file \'%s\': %s\n",
          path, strerror(errno));
        free(data);
        return NULL;
      }
    }
  }

  /* trim the allocation down to size */
  data = realloc(data, iter);
  *readamt = iter;

  return data;
}

int process_args(struct arg_state * args)
{
  int i;

  /* For each file, load it in to memory
   * TODO: defer this until transfer time (save memory and pipeline IO)
   */

  for(i = 0; i < args->numFiles; i++)
  {
    struct file_upload * f = args->files[i];

    f->data = read_file(f->path, &f->size);

    if(!f->data)
    {
      return 1;
    }
  }

  if(g_verbose > 0)
  {
    for(i = 0; i < args->numFiles; i++)
    {
      struct file_upload * f = args->files[i];

      printf("File \'%s\' at 0x%08x, size %zu\n", 
        f->basename, f->addr, f->size);
    }
  }

  libusb_context * ctx;
  libusb_device_handle * dev;
  int ret;

  if((ret = libusb_init(&ctx)) < 0)
  {
    log_error("failed to initialize libusb context: %s\n",
        libusb_error_name(ret));
    return ret;
  }

  dev = omap_usb_open(ctx, args->vendor, args->product);

  if(!dev)
  {
    libusb_exit(ctx);
    return 1;
  }

  /* Set USB configuration */
  int active_config = 0;
  ret = libusb_get_configuration(dev, &active_config);
  if(ret < 0)
  {
    log_error("warning: failed to query USB configuration: %s\n", libusb_error_name(ret));
  }
  else if(active_config != 1)
  {
    ret = libusb_set_configuration(dev, 1);
    if(ret < 0 && ret != LIBUSB_ERROR_BUSY)
    {
      log_error("warning: failed to set USB configuration: %s\n", libusb_error_name(ret));
    }
  }

  if((ret = libusb_claim_interface(dev, 0)) < 0)
  {
    log_error("warning: failed to claim interface: %s\n", libusb_error_name(ret));
    /* Continue anyway - some devices don't have interfaces in DFU mode */
  }

  /* Communicate with the TI BootROM directly
      - retrieve ASIC ID
      - start peripheral boot
      - upload first file
      - execute first file
   */
  if(!transfer_first_stage(dev, args))
  {
    log_error("failed to transfer the first stage file \'%s\'\n",
        args->files[0]->basename);
    goto fail;
  }

  /* Wait a moment before attempting to communicate with X-loader. If we don't
   * wait here, some computers end up failing to upload additional files.
   */
  usleep(20000);
  
  /* If we are passed one file, assume that the user just wants to
     upload some initial code with no X-loader chaining
   */
  if(args->numFiles > 1)
  {
    if(!transfer_other_files(dev, args))
    {
      log_error("failed to transfer the additional files in to memory\n");
      goto fail;
    }
  }

  log_info("successfully transfered %d %s\n", args->numFiles,
      (args->numFiles > 1) ? "files" : "file");

  /* safely close our USB handle and context */
  libusb_close(dev);
  libusb_exit(ctx);
  return 0;

fail:
  libusb_close(dev);
  libusb_exit(ctx);

  return 1;
}

bool omap_usb_read(libusb_device_handle * handle, unsigned char * data,
    int length, int * actualLength)
{
  int ret = 0;
  int iter = 0;
  int sizeLeft = length;

  if(!actualLength)
    return false;

  while(sizeLeft > 0)
  {
    int actualRead = 0;
    int readAmt = sizeLeft;

    usleep(1000);
    ret = libusb_bulk_transfer(handle, OMAP_USB_BULK_IN, data+iter,
        readAmt, &actualRead, USB_TIMEOUT);

    if(ret == LIBUSB_ERROR_TIMEOUT)
    {
      sizeLeft -= actualRead;
      iter += actualRead;

      /* we got some data, lets cut our losses and stop here */
      if(iter > 0)
        break;

      log_error(
          "device timed out while transfering in %d bytes (got %d)\n",
          length, iter);

      return false;
    }
    else if(ret == LIBUSB_SUCCESS)
    {
      /* we cant trust actualRead on anything but a timeout or success */
      sizeLeft -= actualRead;
      iter += actualRead;

      /* stop at the first sign of data */
      if(iter > 0)
        break;
    }
    else
    {
      log_error(
          "fatal transfer error (BULK_IN) for %d bytes (got %d): %s\n",
          length, iter, libusb_error_name(ret));
      return false;
    }
  }

  *actualLength = iter;

  return true;
}

bool omap_usb_write(libusb_device_handle * handle, unsigned char * data,
    int length)
{
  int ret = 0;
  int numTimeouts = 0;
  int iter = 0;
  int sizeLeft = length;

  while(sizeLeft > 0)
  {
    int actualWrite = 0;
    int writeAmt = sizeLeft;
    /* Only send 512 bytes at a time. Helps with reliability sometimes. */
    if(writeAmt > OMAP_USB_MAX_XFER) { writeAmt = OMAP_USB_MAX_XFER; }

    usleep(1000);
    ret = libusb_bulk_transfer(handle, OMAP_USB_BULK_OUT, data+iter,
        writeAmt, &actualWrite, USB_TIMEOUT);

    if(ret == LIBUSB_ERROR_TIMEOUT)
    {
      numTimeouts++;
      sizeLeft -= actualWrite;
      iter += actualWrite;

      /* build in some reliablity */
      if(numTimeouts > USB_MAX_TIMEOUTS)
      {
        log_error(
            "device timed out while transfering out %d bytes (%d made it)\n",
            length, iter);
        return false;
      }
    }
    else if(ret == LIBUSB_SUCCESS)
    {
      /* we cant trust actualWrite on anything but a timeout or success */
      sizeLeft -= actualWrite;
      iter += actualWrite;
    }
    else
    {
      log_error(
          "fatal transfer error (BULK_OUT) for %d bytes (%d made it): %s\n",
          length, iter, libusb_error_name(ret));
      return false;
    }
  }

  return true;
}

int transfer_first_stage(libusb_device_handle * handle, struct arg_state * args)
{
  unsigned char * buffer = NULL;
  uint32_t cmd = 0;
  uint32_t filelen = 0;
  int bufSize = 0x200;
  int transLen = 0;
  int i;

  struct file_upload * file = args->files[0];

  /* TODO determine buffer size based on endpoint */
  buffer = calloc(bufSize, sizeof(unsigned char));
  filelen = cpu_to_le32(file->size);

  /* read the ASIC ID */
  if(!omap_usb_read(handle, buffer, bufSize, &transLen))
  {
    log_error("failed to read ASIC ID from USB connection. "
        "Check your USB device!\n");
    goto fail;
  }

  if(transLen != OMAP_ASIC_ID_LEN)
  {
    log_error("got some ASIC ID, but it's not the right length, %d "
        "(expected %d)\n", transLen, OMAP_ASIC_ID_LEN);
    goto fail;
  }

  /* optionally, print some ASIC ID info */
  if(g_verbose)
  {
    char * fields[] = { "Num Subblocks", "Device ID Info", "Reserved",
      "Ident Data", "Reserved", "CRC (4 bytes)"};
    int fieldLen[] = {1, 7, 4, 23, 23, 11};
    int field = 0;
    int nextSep = 0;

    log_info("got ASIC ID - ");

    for(i = 0; i < transLen; i++)
    {
      if(i == nextSep)
      {
        fprintf(stdout, "%s%s ", (field > 0) ? ", " : "", fields[field]);
        nextSep += fieldLen[field];
        field++;

        fprintf(stdout, "[");
      }

      fprintf(stdout, "%02x", buffer[i]);

      if(i+1 == nextSep)
        fprintf(stdout, "]");
    }

    fprintf(stdout, "\n");
  }

  /* send the peripheral boot command */
  cmd = cpu_to_le32(OMAP_PERIPH_BOOT);

  if(!omap_usb_write(handle, (unsigned char *)&cmd, sizeof(cmd)))
  {
    log_error("failed to send the peripheral boot command 0x%08x\n",
        OMAP_PERIPH_BOOT);
    goto fail;
  }

  /* send the length of the first file (little endian) */
  if(!omap_usb_write(handle, (unsigned char *)&filelen, sizeof(filelen)))
  {
    log_error("failed to length specifier of %u to OMAP BootROM\n", filelen);
    goto fail;
  }

  /* send the file! */
  if(!omap_usb_write(handle, file->data, file->size))
  {
    log_error("failed to send file \'%s\' (size %u)\n",
      file->basename, filelen);
    goto fail;
  }

  free(buffer);
  return 1;

fail:
  free(buffer);
  return 0;
}

int transfer_other_files(libusb_device_handle * handle, struct arg_state * args)
{
  uint32_t * buffer = NULL;
  int bufSize = 128*sizeof(*buffer);
  int numFailures = 0; /* build in some reliablity */
  int maxFailures = 3;
  int transLen = 0;
  int curFile = 1; /* skip the first file */

  buffer = calloc(bufSize, sizeof(unsigned char));

  /* handle the state machine for the X-Loader */
  while(curFile < args->numFiles)
  {
    uint32_t opcode = 0;
    uint8_t * extra = NULL;
    struct file_upload * f = args->files[curFile];

    /* read the opcode from xloader ID */
    if(!omap_usb_read(handle, (unsigned char *)buffer, bufSize, &transLen))
    {
      numFailures++;

      if(numFailures >= maxFailures)
      {
        log_error("failed to read command from X-Loader\n");
        goto fail;
      }

      /* sleep a bit */
      usleep(2000*1000); /* 2s */
      continue; /* try the opcode read again */
    }

    if(transLen < 8)
    {
      log_error("failed to recieve enough data for the opcode\n");
      goto fail;
    }

    /* extract the opcode and extra data pointer */
    opcode = le32_to_cpu(buffer[0]);
    extra = (uint8_t *)buffer;

    switch(opcode)
    {
    /* X-loader is requesting a file to be sent */
    case USBLOAD_CMD_FILE_REQ:
      /* send the opcode, size, and addr */
      buffer[0] = cpu_to_le32(USBLOAD_CMD_FILE);
      buffer[1] = cpu_to_le32(f->size);
      buffer[2] = cpu_to_le32(f->addr);

      if(!omap_usb_write(handle, (unsigned char *)buffer, sizeof(*buffer)*3))
      {
        log_error("failed to send load file command to the X-loader\n");
        goto fail;
      }

      if(g_verbose)
      {
        log_info("uploading \'%s\' (size %zu) to 0x%08x\n",
            f->basename, f->size, f->addr);
      }
      break;
    /* X-loader confirms the size to recieve */
    case USBLOAD_CMD_ECHO_SZ:
      if(buffer[1] != f->size)
      {
        log_error("X-loader failed to recieve the right file size for "
            "file \'%s\' (got %u, expected %zu)\n",
            f->basename, buffer[1], f->size);
        goto fail;
      }

      /* upload the raw file data */

      if(!omap_usb_write(handle, f->data, f->size))
      {
        log_error("failed to send file \'%s\' to the X-loader\n", f->basename);
        goto fail;
      }
      break;
    /* X-loader confirms the amount of data it recieved */
    case USBLOAD_CMD_REPORT_SZ:
      if(buffer[1] != f->size)
      {
        log_error("X-loader failed to recieve the right amount of data for "
            "file \'%s\' (got %u, expected %zu)\n",
            f->basename, buffer[1], f->size);
        goto fail;
      }

      curFile++; /* move on to the next file */
      break;
    /* X-loader debug message */
    case USBLOAD_CMD_MESSAGE:
    {
      size_t len = strlen((char *)extra);

      if(len > (bufSize - sizeof(opcode) - 1))
        log_error("X-loader debug message not NUL terminated (size %zu)\n",
            len);
      else
        fprintf(stdout, "X-loader Debug: %s\n", extra);

      break;
    }
    default:
      log_error("unknown X-Loader opcode 0x%08X (%c%c%c%c)\n",
          opcode, extra[0], extra[1], extra[2], extra[3]);
      goto fail;
    }
  }

  /* we're done uploading files to X-loader send the jump command */
  int jumpCmd[3];
  jumpCmd[0] = cpu_to_le32(USBLOAD_CMD_JUMP);
  jumpCmd[1] = cpu_to_le32(args->jumpTarget);
  jumpCmd[2] = 0; /* padding? */

  log_info(
    "sending jump command: 0x%08x, 0x%08x, %d\n", 
    jumpCmd[0], 
    jumpCmd[1],
    sizeof(jumpCmd));

  if(!omap_usb_write(handle, (unsigned char *)jumpCmd, sizeof(jumpCmd)))
  {
    log_error("failed to send the final jump command to the X-loader. "
        "Target was 0x%08x\n", args->jumpTarget);
    goto fail;
  }

  if(g_verbose)
    log_info("jumping to address 0x%08x\n", args->jumpTarget);

  free(buffer);
  return 1;

fail:
  free(buffer);
  return 0;
}

/* getopt configuration */
int do_version = 0;
const char * const short_opt= "f:a:j:i:p:vh";
const struct option long_opt[] = 
{
  {"file",    1, NULL, 'f'},
  {"addr",    1, NULL, 'a'},
  {"jump",    1, NULL, 'j'},
  {"vendor",  1, NULL, 'i'},
  {"product", 1, NULL, 'p'},
  {"verbose", 0, NULL, 'v'},
  {"help",    0, NULL, 'h'},
  {"version", 0, &do_version, 1},
  {NULL,      0, NULL, 0  }
};

void usage(char * exe)
{
  printf("Usage: %s [options] -f first-stage [-f file -a addr]...\n", exe);
  printf("Options:\n");
  printf("  -f, --file      Provide the filename of a binary file to be\n");
  printf("                  uploaded. The first file specified is uploaded to\n");
  printf("                  the fixed address 0x%08x as defined by the manual.\n",
      OMAP_BASE_ADDRESS);
  printf("                  Additional files must be followed by an address\n");
  printf("                  argument (-a).\n");
  printf("  -a, --addr      The address to load the prior file at.\n");
  printf("  -j, --jump      Specify the address to jump to after loading all\n");
  printf("                  of the files in to memory.\n");
  printf("  -i, --vendor    Override the default vendor ID to poll for\n");
  printf("                  (default 0x%04x).\n", OMAP_VENDOR_ID);
  printf("  -p, --product   Override the default product ID to poll for\n");
  printf("                  (default 0x%04x).\n", OMAP_PRODUCT_ID);
  printf("  -h, --help      Display this message.\n");
  printf("  -v, --verbose   Enable verbose output.\n");
  printf("\n");
  printf("Description:\n");
  printf("  %s's basic usage is to upload an arbitrary file in to the memory\n",
      PROG_NAME);
  printf("  of a TI OMAP3 compatible processor. This program directly\n");
  printf("  communicates with the TI BootROM in order to upload a first stage\n");
  printf("  payload, in most cases, TI's X-Loader. Using a compatible X-Loader\n");
  printf("  will enable the upload of any file to any part in device memory.\n");
  printf("\n");
  printf("Examples:\n");
  printf(
"  Uploading a compatible X-Loader, U-Boot, Kernel, and RAMDisk, then jumping\n"
"  to the U-Boot image for further bootloading:\n");
  printf(
"    %s -f x-load.bin -f u-boot.bin -a 0x80200000 -f uImage -a 0x80800000 \\\n"
"       -f uRamdisk -a 0x81000000 -j 0x80200000\n", exe);
  printf(
"  Uploading arbitrary code to be executed (doesn't have to be X-loader):\n");
  printf(
"    %s -f exec_me.bin\n", exe);
  printf("  Trying to debug an upload issue using verbose output:\n");
  printf("    %s -v -f exec_me.bin -f file1.bin -a 0xdeadbeef -j 0xabad1dea\n",
      exe);
  printf("\n");
  printf("Authors:\n");
  printf(
"  Grant Hernandez <grant.h.hernandez@gmail.com> - rewrite of omap3_usbload to\n");
  printf(
"    use the newer libusb 1.0\n");
  printf(
"  Martin Mueller <martinmm@pfump.org> - initial code (omap3_usbload)\n");
  printf(
"    and X-Loader patch\n");
}

void license()
{
  printf("Copyright (C) 2008 Martin Mueller <martinmm@pfump.org>\n");
  printf("Copyright (C) 2014 Grant Hernandez <grant.h.hernandez@gmail.com>\n");
  printf("License GPLv2: GNU GPL version 2 or later <http://gnu.org/licenses/gpl.html>.\n");
  printf("This is free software: you are free to change and redistribute it.\n");
  printf("There is NO WARRANTY, to the extent permitted by law.\n");
}

void log_error(char * fmt, ...)
{
  va_list va;
  
  va_start(va, fmt);
  fprintf(stdout, "[-] ");
  vfprintf(stdout, fmt, va);
  va_end(va);
}

void log_info(char * fmt, ...)
{
  va_list va;
  
  va_start(va, fmt);
  fprintf(stdout, "[+] ");
  vfprintf(stdout, fmt, va);
  va_end(va);
}


int main(int argc, char * argv[])
{
  int opt;
  bool gotFile = false;
  bool gotJump = false;
  int fileCount = 0;
  char * exe = NULL;

  /* temporary local file object */
  struct file_upload file;
  /* total arg state */
  struct arg_state * args = calloc(1, sizeof(*args));

  log_info("jump command: 0x%08x\n", USBLOAD_CMD_JUMP);
  log_info("jump command le: 0x%08x\n", cpu_to_le32(USBLOAD_CMD_JUMP));
  
  if(argc < 1)
  {
    log_error("invalid arguments (no argv[0])\n");
    return 1;
  }

  exe = argv[0];

  fprintf(stdout, "%s %s\n", PROG_NAME, VERSION);

  /* set the default vendor and product */
  args->vendor = OMAP_VENDOR_ID;
  args->product = OMAP_PRODUCT_ID;

  while((opt = getopt_long(argc, argv, short_opt, long_opt, NULL)) != -1)
  {
    switch(opt)
    {
    case 0:
      if(do_version) {
        license();
        return 0;
      }
      break;
    case 'f':
    {
      if(gotFile)
      {
        log_error("missing address argument (-a) for file \'%s\'\n",
          file.path);
        usage(exe);
        return 1;
      }

      file.path = strdup(optarg);

      /* necessary to be sure that we own all the memory
         and that the path input can be modified */
      char * tmpPath = strdup(file.path);
      file.basename = strdup(basename(tmpPath));
      free(tmpPath);

      fileCount++;

      /* the first file gets uploaded to a fixed address 
         as specified by the technical reference manual */
      if(fileCount == 1)
      {
        file.addr = OMAP_BASE_ADDRESS;

        /* commit the file object with the processor specified base address */
        args->files = realloc(args->files, fileCount * sizeof(struct file_upload *));
        args->numFiles = fileCount;
        args->files[fileCount-1] = malloc(sizeof(file));
        memcpy(args->files[fileCount-1], &file, sizeof(file));
      }
      else
      {
        /* commit only after an address is specified */
        gotFile = true;
      }
      break;
    }
    case 'a':
      if(!gotFile)
      {
        log_error("missing file argument (-f) before address \'%s\'\n", 
          optarg);
        usage(exe);
        return 1;
      }

      /* passing 0 to strtoul enables detection of the 0x prefix with
         base-10 fallback if missing */
      file.addr = strtoul(optarg, NULL, 0);

      /* commit the file object */
      args->files = realloc(args->files, fileCount * sizeof(struct file_upload *));
      args->numFiles = fileCount;
      args->files[fileCount-1] = malloc(sizeof(file));
      memcpy(args->files[fileCount-1], &file, sizeof(file));

      gotFile = false;
      break;
    case 'j':
      args->jumpTarget = strtoul(optarg, NULL, 0);
      gotJump = true;
      break;
    case 'i':
      args->vendor = (uint16_t)strtoul(optarg, NULL, 0);
      break;
    case 'p':
      args->product = (uint16_t)strtoul(optarg, NULL, 0);
      break;
    case 'v':
      g_verbose++;
      break;
    case 'h':
      usage(exe);
      return 0;
    default:
      usage(exe);
      return 1;
    }
  }

  if(gotFile)
  {
    log_error("got file \'%s\', but no address!\n", file.path);
    usage(exe);
    return 1;
  }

  if(args->numFiles <= 0)
  {
    log_error("at least one file needs to be specified\n");
    usage(exe);
    return 1;
  }

  if(args->numFiles == 1 && gotJump)
  {
    log_info("WARNING: jump target 0x%08x specified, but will never be taken "
        "(more than one file required)\n", args->jumpTarget);
  }
  else if(args->numFiles > 1 && !gotJump)
  {
    log_info("WARNING: no jump target specified. Defaulting to the first "
        "file's (\'%s\') address 0x%08x\n", 
        args->files[1]->basename, args->files[1]->addr);
    args->jumpTarget = args->files[1]->addr;
  }

  return process_args(args);
}