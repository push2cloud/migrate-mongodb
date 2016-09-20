FROM library/mongo:3.3.12

RUN apt-get update && \
    apt-get install -y jq && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

COPY ./migrate.sh /migrate.sh

CMD [ "/migrate.sh" ]
