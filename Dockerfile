FROM pierrezemb/gostatic
COPY . /srv/http/
COPY headerConfig.json /config/headerConfig.json
CMD ["-port","8080","-https-promote", "-enable-logging"]
