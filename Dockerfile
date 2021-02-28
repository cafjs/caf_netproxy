# VERSION 0.1
# DOCKER-VERSION  1.7.0
# AUTHOR:         Antonio Lain <antlai@cafjs.com>
# DESCRIPTION:    Cloud Assistants network proxy (based on 'HAProxy')
# TO_BUILD:       cafjs mkImage . gcr.io/cafjs-k8/root-netproxy
# TO_RUN:         docker run -p 80:80 -p 443:443 -e HOST=<host_ip> -e REDIS_PORT_6379_TCP_PORT=<redis_port>   gcr.io/cafjs-k8/root-netproxy
#                    or use docker-compose up -d (for local testing)
#                    or, if redis is already locally running:
#                  docker run -p 80:80 -p 443:443 --link <redis_name>:redis gcr.io/cafjs-k8/root-netproxy


FROM node:14

EXPOSE 80

EXPOSE 443

ADD ./app/config /config

ADD  ./app/config/apt.conf /etc/apt/apt.conf

RUN cp /config/haproxy.cfg /tmp/haproxy.cfg && useradd haproxy

RUN  apt-get update && apt-get install -y sudo
#adapted from official haproxy docker image

ENV HAPROXY_VERSION 1.5.19
ENV HAPROXY_URL https://www.haproxy.org/download/1.5/src/haproxy-1.5.19.tar.gz
ENV HAPROXY_SHA256 e00ae2a633da614967f2e3ebebdb817ec537cba8383b833fc8d9a506876e0d5e

# see https://sources.debian.net/src/haproxy/jessie/debian/rules/ for some helpful navigation of the possible "make" arguments
RUN set -x \
	\
	&& savedAptMark="$(apt-mark showmanual)" \
	&& apt-get update && apt-get install -y --no-install-recommends \
		ca-certificates \
		gcc \
		libc6-dev \
		libpcre2-dev \
		libssl1.0-dev \
		make \
		wget \
		zlib1g-dev \
	&& rm -rf /var/lib/apt/lists/* \
	\
	&& wget -O haproxy.tar.gz "$HAPROXY_URL" \
	&& echo "$HAPROXY_SHA256 *haproxy.tar.gz" | sha256sum -c \
	&& mkdir -p /usr/src/haproxy \
	&& tar -xzf haproxy.tar.gz -C /usr/src/haproxy --strip-components=1 \
	&& rm haproxy.tar.gz \
	\
	&& makeOpts=' \
		TARGET=linux2628 \
		USE_GETADDRINFO=1 \
		USE_OPENSSL=1 \
		USE_PCRE2=1 USE_PCRE2_JIT=1 \
		USE_ZLIB=1 \
		\
		EXTRA_OBJS=" \
		" \
	' \
	&& nproc="$(nproc)" \
	&& eval "make -C /usr/src/haproxy -j '$nproc' all $makeOpts" \
	&& eval "make -C /usr/src/haproxy install-bin $makeOpts" \
	\
	&& mkdir -p /usr/local/etc/haproxy \
	&& cp -R /usr/src/haproxy/examples/errorfiles /usr/local/etc/haproxy/errors \
	&& rm -rf /usr/src/haproxy \
	\
	&& apt-mark auto '.*' > /dev/null \
	&& { [ -z "$savedAptMark" ] || apt-mark manual $savedAptMark; } \
	&& find /usr/local -type f -executable -exec ldd '{}' ';' \
		| awk '/=>/ { print $(NF-1) }' \
		| sort -u \
		| xargs -r dpkg-query --search \
		| cut -d: -f1 \
		| sort -u \
		| xargs -r apt-mark manual \
	&& apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false


RUN mkdir -p /usr/src

ENV PATH="/usr/src/node_modules/.bin:${PATH}"

ENV PATH="/usr/local/bin:${PATH}"

RUN yarn config set prefix /usr/local

RUN yarn global add caf_build && yarn cache clean

COPY . /usr/src

RUN  cd /usr/src/app && yarn install --production --ignore-optional && cafjs build && yarn cache clean

WORKDIR /usr/src/app

ENTRYPOINT ["node"]

CMD [ "./start.js" ]
