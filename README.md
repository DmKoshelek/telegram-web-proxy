# Telegram Web Proxy
A simple implementation of a proxy tunnel for telegram servers (HTTPS and WSS).

It also includes a slightly modified version of Telegram Web K client to send 
traffic though the hosting server and resend to telegram servers.

Can be useful if all connection to telegram.org are blocked, and it is not possible to use desktop or mobile client as well 

## Is it safe to use

As all traffic are encrypted by clients and server itself (check [MTProto](https://core.telegram.org/mtproto)), the proxy tunnel only see encrypted traffic and you data can't be exposed.

The project also use the fork of the official open source [Telegram Web K client](https://github.com/DmKoshelek/tweb). The only modification in it is a url resolving  module to send traffic to proxy tunnel.

## How to run it

To run the project you will need a local deno server or a docker. In both cases after start the client will be on http://localhost:8765/tg/. 

But it will not fork locally without SSL certificate (I just relied on hosting services SSL). So you can install it or update and rebuild web client to use http and ws

#### Locally 

```
deno task start
```

#### Docker 

```
docker build -t dilegram .
docker run --env-file .env -p 8765:8765 -it dilegram
```

## How to build docker container

```
docker build -t shellman1/telegram-web-proxy .
docker push shellman1/telegram-web-proxy:latest
```

## How to deploy

You can use the docker image to deploy it on [koyeb.com](https://koyeb.com) or [northflank.com](https://northflank.com/) for free (I tried both, bith are working great)
`docker.io/shellman1/telegram-web-proxy:latest`. Just expose port 8765, set health check on **/healthz** endpoint and the app will be ready to be used
