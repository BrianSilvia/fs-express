FROM node:5.3.0

RUN mkdir /app

WORKDIR /app

RUN npm install -g pm2

ADD package.json package.json
RUN npm install

ADD src/ src/
ADD test/ test/

RUN npm prune

CMD npm start
