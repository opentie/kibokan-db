FROM node:6

RUN mkdir /app
ADD package.json /app/package.json
RUN npm install --no-dev
ADD . /app
WORKDIR /app

EXPOSE 8124

CMD npm start
