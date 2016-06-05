FROM node:6

RUN mkdir /app
WORKDIR /app
ADD package.json /app/package.json
RUN npm install --no-dev
ADD . /app

EXPOSE 8124

CMD npm start
