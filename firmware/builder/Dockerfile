FROM --platform=linux/amd64 ubuntu:20.04

ENV DEBIAN_FRONTEND=noninteractive

RUN dpkg --add-architecture i386 && apt-get update && apt-get install -y \
    build-essential \
    git \
    curl \
    wget \
    bzip2 \
    cpio \
    sed \
    gawk \
    bc \
    libncurses5-dev \
    u-boot-tools \
    gcc-multilib \
    g++-multilib \
    libc6:i386 \
    libstdc++6:i386 \
    zlib1g:i386 \
    libncurses5:i386 \
    rsync \
    file \
    && rm -rf /var/lib/apt/lists/*

RUN apt-get update && apt-get install -y \
    libperl-dev \
    && rm -rf /var/lib/apt/lists/* && \
    wget https://www.cpan.org/src/5.0/perl-5.34.0.tar.gz && \
    tar -xzf perl-5.34.0.tar.gz && \
    cd perl-5.34.0 && \
    ./Configure -des -Dprefix=/usr/local && \
    make -j$(nproc) && \
    make install && \
    cd .. && \
    rm -rf perl-5.34.0 perl-5.34.0.tar.gz && \
    ln -sf /usr/local/bin/perl /usr/bin/perl

ENV FORCE_UNSAFE_CONFIGURE=1

WORKDIR /work

CMD ["/bin/bash"]
