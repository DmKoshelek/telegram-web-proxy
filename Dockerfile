FROM denoland/deno:alpine-1.42.1

WORKDIR /app

COPY main.ts ./main.ts
COPY tg ./tweb/public

EXPOSE 8765

CMD ["run", "--allow-net", "--allow-read", "main.ts"]