# -*- coding: utf-8 -*-
import io
import json
import os
import glob
import requests
import urllib.parse
import sys


from argparse import ArgumentParser

parser = ArgumentParser()
parser.add_argument("-p", "--path", 
        help="log path", dest="p", default="app/static/line")
parser.add_argument("-i", "--id", 
        help="chrome extension id", dest="i", default="oamhaiapniikdcfejkobaffhlkjncpoe")
parser.add_argument("-u", "--url", 
        help="server url", dest="u", default="http://localhost:8080")
parser.add_argument("-l", "--login", 
        help="login api", dest="l", default="/api/v1/security/login")
parser.add_argument("-c", "--concat", 
        help="concat api", dest="c", default="/api/1.0/contactmodelapi/add")
parser.add_argument("--username", 
        help="login username", dest="username", default="addline")
parser.add_argument("--password", 
        help="concat api", dest="password", default="ZAHVjB$WLM*@6fV46?B&$Y+ELW+fvd%q")

args = parser.parse_args()
files = glob.glob1(args.p, "*" + args.i + "*.json")

if len(files) is 0:
  sys.exit("no file, 81")

out = []
for f in files:
    fullpath = os.path.join(args.p, f)
    #print("read ", fullpath)
    with open(fullpath, 'r', encoding='UTF-8') as file:
        json_str = file.read()
    json_dict = json.loads(json_str)['chat']

    for e in out:
        new_index = next((index for (index, d) in enumerate(json_dict) if d.get("id", None) == e.get("id", None)), None)

        if new_index:
            e['chat'] = e['chat'] + json_dict[new_index]['chat']
            del json_dict[new_index]
        #print("merge:", e['chat'])
        #print("merge:", e.get('id', None), z)
        #print(e, new_index)
    #print("unmerge:", json_dict)
    out = out + json_dict 

filename = "/tmp/1"
output = {'len': 0, 'chat': []}
output['len'] = len(out)
output['chat'] = out
output['rid'] = args.i

headers = {'Content-type': 'application/json'}
auth = {"username": args.username, "password": args.password, "provider": "db"}
r = requests.post(urllib.parse.urljoin(args.u, args.l), json=auth, headers=headers)
#print(r.status_code, r.json())
result = r.json()
TOKEN = result['access_token']

headers = {'Content-type': 'application/json', 'Authorization': 'Bearer ' + TOKEN}
r = requests.post(urllib.parse.urljoin(args.u, args.c), json=output, headers=headers)
#print(r.status_code, r.json())
if r.status_code is 200:
    for f in files:
        fullpath = os.path.join(args.p, f)
        os.remove(fullpath)
    print(r.json())
else:
    print(r.status_code, r.json())

#with io.open(filename, 'w', encoding='UTF-8') as file:
#    file.write(json.dumps(output, ensure_ascii=False))
