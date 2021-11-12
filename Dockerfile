# VERSION 0.1
# DOCKER-VERSION  1.7.0
# AUTHOR:         Antonio Lain <antlai@cafjs.com>
# DESCRIPTION:    Cloud Assistants network proxy (based on 'HAProxy')
# TO_BUILD:       cafjs mkImage . gcr.io/cafjs-k8/root-netproxy
# TO_RUN:         docker run -p 80:80 -p 443:443 -e HOST=<host_ip> -e REDIS_PORT_6379_TCP_PORT=<redis_port>   gcr.io/cafjs-k8/root-netproxy
#                    or use docker-compose up -d (for local testing)
#                    or, if redis is already locally running:
#                  docker run -p 80:80 -p 443:443 --link <redis_name>:redis gcr.io/cafjs-k8/root-netproxy


FROM node:16

EXPOSE 80

EXPOSE 443

ADD ./app/config /config

ADD  ./app/config/apt.conf /etc/apt/apt.conf

RUN cp /config/haproxy.cfg /tmp/haproxy.cfg && useradd haproxy

RUN  apt-get update && apt-get install -y sudo
#adapted from official haproxy docker image

ENV HAPROXY_VERSION 1.7.14
ENV HAPROXY_URL https://www.haproxy.org/download/1.7/src/haproxy-1.7.14.tar.gz
ENV HAPROXY_SHA256 1f9fb6c5a342803037a622c7dd04702b0d010a88b5c3922cd3da71a34f3377a4

# see https://sources.debian.net/src/haproxy/jessie/debian/rules/ for some helpful navigation of the possible "make" arguments
RUN set -eux; \
	\
	savedAptMark="$(apt-mark showmanual)"; \
	apt-get update && apt-get install -y --no-install-recommends \
		ca-certificates \
		gcc \
		libc6-dev \
		liblua5.3-dev \
		libpcre2-dev \
		libssl-dev \
		make \
		wget \
		zlib1g-dev \
	; \
	rm -rf /var/lib/apt/lists/*; \
	\
	wget -O haproxy.tar.gz "$HAPROXY_URL"; \
	echo "$HAPROXY_SHA256 *haproxy.tar.gz" | sha256sum -c; \
	mkdir -p /usr/src/haproxy; \
	tar -xzf haproxy.tar.gz -C /usr/src/haproxy --strip-components=1; \
	rm haproxy.tar.gz; \
	\
	makeOpts=' \
		TARGET=linux2628 \
		USE_GETADDRINFO=1 \
		USE_LUA=1 LUA_INC=/usr/include/lua5.3 \
		USE_OPENSSL=1 \
		USE_PCRE2=1 USE_PCRE2_JIT=1 \
		USE_ZLIB=1 \
		\
		EXTRA_OBJS=" \
		" \
	'; \
# https://salsa.debian.org/haproxy-team/haproxy/-/commit/53988af3d006ebcbf2c941e34121859fd6379c70
	dpkgArch="$(dpkg --print-architecture)"; \
	case "$dpkgArch" in \
		armel) makeOpts="$makeOpts ADDLIB=-latomic" ;; \
	esac; \
	\
	nproc="$(nproc)"; \
	eval "make -C /usr/src/haproxy -j '$nproc' all $makeOpts"; \
	eval "make -C /usr/src/haproxy install-bin $makeOpts"; \
	\
	mkdir -p /usr/local/etc/haproxy; \
	cp -R /usr/src/haproxy/examples/errorfiles /usr/local/etc/haproxy/errors; \
	rm -rf /usr/src/haproxy; \
	\
	apt-mark auto '.*' > /dev/null; \
	[ -z "$savedAptMark" ] || apt-mark manual $savedAptMark; \
	find /usr/local -type f -executable -exec ldd '{}' ';' \
		| awk '/=>/ { print $(NF-1) }' \
		| sort -u \
		| xargs -r dpkg-query --search \
		| cut -d: -f1 \
		| sort -u \
		| xargs -r apt-mark manual \
	; \
	apt-get purge -y --auto-remove -o APT::AutoRemove::RecommendsImportant=false; \
	\
# smoke test
	haproxy -v

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
