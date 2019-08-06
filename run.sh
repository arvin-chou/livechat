#! /bin/bash
#gunicorn -w 1 --timeout 120 -b localhost:8080 --limit-request-line 0 --limit-request-field_size 0 --worker-class eventlet run:app
gunicorn \
      -w 1 \
      --timeout 120 \
      -b  localhost:8080 \
      --limit-request-line 0 \
      --limit-request-field_size 0 \
      --worker-class eventlet \
      run:app
      #-k gevent \
      #"run:create_app('production')"
      #"run:socketio.run(app)"
      #--statsd-host localhost:8125 \
