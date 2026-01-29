FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y \
    build-essential \
    ruby-full \
    bundler \
    git \
    curl \
    ca-certificates \
    cmake \
    ccache \
    libgl1 \
    libglx-mesa0 \
    libegl-mesa0 \
    libglu1-mesa \
    libuv1-dev \
    libcurl4-openssl-dev \
    xvfb \
    libpng-dev \
    jq \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 from NodeSource
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Install legacy libraries needed by prebuilt MapLibre Native binaries
# ICU 70 and libpng 1.6.37 from Ubuntu 22.04
RUN apt-get update && apt-get install -y wget \
    && ARCH=$(dpkg --print-architecture) \
    && if [ "$ARCH" = "arm64" ]; then \
         ICU_URL="http://ports.ubuntu.com/pool/main/i/icu/libicu70_70.1-2_arm64.deb"; \
         PNG_URL="http://ports.ubuntu.com/pool/main/libp/libpng1.6/libpng16-16_1.6.37-3build5_arm64.deb"; \
       else \
         ICU_URL="http://security.ubuntu.com/ubuntu/pool/main/i/icu/libicu70_70.1-2_amd64.deb"; \
         PNG_URL="http://security.ubuntu.com/ubuntu/pool/main/libp/libpng1.6/libpng16-16_1.6.37-3build5_amd64.deb"; \
       fi \
    && wget $ICU_URL -O libicu70.deb \
    && wget $PNG_URL -O libpng16-16.deb \
    && dpkg -i libicu70.deb \
    && dpkg --remove --force-depends libpng16-16t64 \
    && dpkg -i libpng16-16.deb \
    && rm *.deb \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace

COPY viewer/package*.json viewer/
COPY package*.json ./

RUN cd viewer && npm install
RUN npm install

COPY Gemfile* ./

RUN gem install bundler:2.6.9

RUN bundle install

COPY . .

# rebuild native modules (not sure why but this only works at runtime, not build time).
# use xvfb-run to provide virtual X display for MapLibre.
CMD npm rebuild && cd viewer && npm rebuild && cd .. && xvfb-run -a make build
