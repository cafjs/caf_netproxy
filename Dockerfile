# VERSION 0.1
# DOCKER-VERSION  1.7.0
# AUTHOR:         Antonio Lain <antlai@cafjs.com>
# DESCRIPTION:    Cloud Assistants network proxy (based on 'HAProxy')
# TO_BUILD:       docker build --rm -t registry.cafjs.com:32000/root-netproxy .
# TO_RUN:         docker run -p 80:80 -p 443:443 -e HOST=<host_ip> -e REDIS_PORT_6379_TCP_PORT=<redis_port>   registry.cafjs.com:32000/root-netproxy
#                    or use docker-compose up -d (for local testing)
#                    or, if redis is already locally running:
#                  docker run -p 80:80 -p 443:443 --link <redis_name>:redis registry.cafjs.com:32000/root-netproxy


FROM node:0.10

EXPOSE 80

EXPOSE 443

ADD ./config /config

ADD  ./config/apt.conf /etc/apt/apt.conf

RUN cp /config/haproxy.cfg /tmp/haproxy.cfg && useradd haproxy

#adapted from official haproxy docker image

RUN apt-get update && apt-get install -y sudo libssl1.0.0 libpcre3 --no-install-recommends && rm -rf /var/lib/apt/lists/*

ENV HAPROXY_MAJOR 1.5
ENV HAPROXY_VERSION 1.5.13
ENV HAPROXY_MD5 30cf07875ecae4fd6c4c309627afa8f1

# see http://sources.debian.net/src/haproxy/1.5.8-1/debian/rules/ for some helpful navigation of the possible "make" arguments
RUN . /config/http_proxy_build; buildDeps='curl gcc libc6-dev libpcre3-dev libssl-dev make' \
	&& set -x \
	&& apt-get update && apt-get install -y $buildDeps --no-install-recommends && rm -rf /var/lib/apt/lists/* \
	&& curl -SL "http://www.haproxy.org/download/${HAPROXY_MAJOR}/src/haproxy-${HAPROXY_VERSION}.tar.gz" -o haproxy.tar.gz \
	&& echo "${HAPROXY_MD5}  haproxy.tar.gz" | md5sum -c \
	&& mkdir -p /usr/src/haproxy \
	&& tar -xzf haproxy.tar.gz -C /usr/src/haproxy --strip-components=1 \
	&& rm haproxy.tar.gz \
	&& make -j 8 -C /usr/src/haproxy \
		TARGET=linux2628 \
		USE_PCRE=1 PCREDIR= \
		USE_OPENSSL=1 \
		USE_ZLIB=1 \
		all \
		install-bin \
	&& mkdir -p /usr/local/etc/haproxy \
	&& cp -R /usr/src/haproxy/examples/errorfiles /usr/local/etc/haproxy/errors \
	&& rm -rf /usr/src/haproxy \
	&& apt-get purge -y --auto-remove $buildDeps

RUN mkdir -p /usr/src/app

WORKDIR /usr/src/app

COPY . /usr/src/app

RUN  . /config/http_proxy_npm; rm -fr node_modules/*; npm install  --ignore-scripts --production .

CMD [ "npm", "start"]