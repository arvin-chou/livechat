#! /bin/bash

URL='http://localhost:8080'
NAME='addline'
PW='ZAHVjB$WLM*@6fV46?B&$Y+ELW+fvd%q'
LINE_FOLDER=app/static/line
UPLOAD_FOLDER=app/static/uploads

if [ "`find "${LINE_FOLDER}" -name "*png*" | wc -l`" -eq 0 ]
then
  echo 'no file update, 81'
  exit
fi

sync_db()
{
  title=$1
  file=$2
  export TOKEN=`curl -XPOST ${URL}/api/v1/security/login -d \
    '{"username": "'${NAME}'", "password": "'${PW}'", "provider": "db"}' \
    -H "Content-Type: application/json" |\
    python3 -c "import sys, json; print(json.load(sys.stdin)['access_token'])"`
  #echo $TOKEN
  curl --insecure -X POST -v \
    -F "name=${title}" \
    -F "description=${title}" \
    -F "file=@${file}" \
    ${URL}/api/1.0/projectmodelview/add -H "Authorization: Bearer $TOKEN"
}


abs_base="$(cd ${LINE_FOLDER}; pwd -P)"
for fullfile in ${LINE_FOLDER}/*png; do
  #if [ "${fullfile}" -eq "" ]; then
  #  break
  #fi

  tmp="tmp"
  cat "${fullfile}" | base64 -D > ${tmp}
  mv "${tmp}" "${fullfile}"

  filename=$(basename -- "$fullfile")
  extension="${filename##*.}"
  filename="${filename%.*}"
  filename=`echo "$filename" | sed -e 's/ .*//g'`
  upload_name=`find "${UPLOAD_FOLDER}" -name "*${filename}*"`
  is_exist=`find "${UPLOAD_FOLDER}" -name "*${filename}*" | wc -l`
  abs_file="$abs_base/$(basename -- "$fullfile")"
  #abs_file="$abs_base/$(basename ${fullfile})"
  #echo $abs_file
  if [ "$is_exist" -eq 0 ]; then
    sync_db "${filename}" "${abs_file}"
    rm "${abs_file}"
    echo "add record"
  else
    #echo "${upload_name}"
    #echo "got"
    mv "${abs_file}" "${upload_name}"
    echo "modify id ${filename}"
  fi
  #echo "$(cd "$(dirname ${fullfile})"; pwd -P)/$(basename ${fullfile})"

done
