#!/bin/bash

set -e
set -o pipefail

if [[ -n ${DEBUG} ]] ; then
  echo "DEBUG: VCAP_SERVICES:   ${VCAP_SERVICES}"
  echo "DEBUG: fromService:     ${fromService}"
  echo "DEBUG: toService:       ${toService}"
fi


if [[ -z ${VCAP_SERVICES} ]] ; then
  echo "\${VCAP_SERVICES} not set!"
  exit 1
fi
if [[ -z ${fromService} ]] ; then
  echo "\${fromService} not set!"
  exit 1
fi
if [[ -z ${toService} ]] ; then
  echo "\${toService} not set!"
  exit 1
fi

declare -A  from
declare -A  to

from[database]=$( echo "${VCAP_SERVICES}" | jq ".mongodb[] | select( .name == \"${fromService}\" ) | .credentials.database" | tr -d '"')
from[host]=$( echo "${VCAP_SERVICES}" | jq ".mongodb[] | select( .name == \"${fromService}\" ) | .credentials.host" | tr -d '"')
from[password]=$( echo "${VCAP_SERVICES}" | jq ".mongodb[] | select( .name == \"${fromService}\" ) | .credentials.password" | tr -d '"')
from[port]=$( echo "${VCAP_SERVICES}" | jq ".mongodb[] | select( .name == \"${fromService}\" ) | .credentials.port" | tr -d '"')
from[username]=$( echo "${VCAP_SERVICES}" | jq ".mongodb[] | select( .name == \"${fromService}\" ) | .credentials.username" | tr -d '"')

to[database]=$( echo "${VCAP_SERVICES}" | jq ".mongodb[] | select( .name == \"${toService}\" ) | .credentials.database" | tr -d '"')
to[host]=$( echo "${VCAP_SERVICES}" | jq ".mongodb[] | select( .name == \"${toService}\" ) | .credentials.host" | tr -d '"')
to[password]=$( echo "${VCAP_SERVICES}" | jq ".mongodb[] | select( .name == \"${toService}\" ) | .credentials.password" | tr -d '"')
to[port]=$( echo "${VCAP_SERVICES}" | jq ".mongodb[] | select( .name == \"${toService}\" ) | .credentials.port" | tr -d '"')
to[username]=$( echo "${VCAP_SERVICES}" | jq ".mongodb[] | select( .name == \"${toService}\" ) | .credentials.username" | tr -d '"')

if [[ -n ${DEBUG} ]] ; then
  echo "DEBUG: from[database]: ${from[database]}"
  echo "DEBUG: from[host]:     ${from[host]}"
  echo "DEBUG: from[password]: ${from[password]}"
  echo "DEBUG: from[port]:     ${from[port]}"
  echo "DEBUG: from[username]: ${from[username]}"

  echo "DEBUG: to[database]: ${to[database]}"
  echo "DEBUG: to[host]:     ${to[host]}"
  echo "DEBUG: to[password]: ${to[password]}"
  echo "DEBUG: to[port]:     ${to[port]}"
  echo "DEBUG: to[username]: ${to[username]}"
fi


if [[ -z ${from[database]} ]] ; then
  echo "could not resolve details of \"${fromService}\" from \${VCAP_SERVICES}!"
  exit 1
fi
if [[ -z ${to[database]} ]] ; then
  echo "could not resolve details of \"${toService}\" from \${VCAP_SERVICES}!"
  exit 1
fi

echo "Starting MongoDB Migration"
echo "  from: ${fromService}"
echo "  to:   ${toService}"
echo ""

if [[ -n ${DEBUG} ]] ; then
echo "Going to execute the following command:
mongodump    --host ${from[host]} \
             --db ${from[database]} \
             --port ${from[port]} \
             --authenticationDatabase ${from[database]} \
             --username ${from[username]} \
             --password ${from[password]} \
             --archive | \
mongorestore --host ${to[host]} \
             --port ${from[port]} \
             --authenticationDatabase ${from[database]} \
             --username ${to[username]} \
             --password ${to[password]} \
             --archive \
             --nsFrom=${from[database]}.* \
             --nsTo=${to[database]}.*
"
fi

mongodump    --host ${from[host]} \
             --db ${from[database]} \
             --port ${from[port]} \
             --authenticationDatabase ${from[database]} \
             --username ${from[username]} \
             --password ${from[password]} \
             --archive | \
mongorestore --host ${to[host]} \
             --port ${to[port]} \
             --authenticationDatabase ${to[database]} \
             --username ${to[username]} \
             --password ${to[password]} \
             --archive \
             --nsFrom=${from[database]}.* \
             --nsTo=${to[database]}.*

echo ""
echo "Finished MongoDB Migration with RC: $?"

while true ; do
  echo "This App can now be deleted"
  sleep 60
done
