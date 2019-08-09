from app import db, socketio, IS_DEBUG
from app import app
import time
from threading import Thread
from flask import Flask, render_template, session, request
from flask_socketio import join_room, leave_room
from app.v.quickfiles import line_background_stuff

@socketio.on('join', namespace='/canary')
def on_join(json, methods=['GET', 'POST']):
    #username = json['username']
    room = json['room']
    join_room(room)
    print('join room', json)
    #send(username + ' has entered the room.', room=room)

@socketio.on('disconnect', namespace='/canary')
def socket_disconnect():
    print('======== socket disconnect ========')
    #send(username + ' has entered the room.', room=room)

@socketio.on('leave')
def on_leave(json, methods=['GET', 'POST']):
    #username = json['username']
    room = json['room']
    leave_room(room)
    #send(username + ' has left the room.', room=room)

thread = None
#@app.route("/")
#def index(self):
#    print("VVV")
#    return "XXX"

#from flask.signals import request_finished
#def expire_session(sender, response, **extra):
#    db.session.expire_all()
#request_finished.connect(expire_session, app)

#def background_stuff():
#     """ python code in main.py """
#     print('In background_stuff')
#     while True:
#         time.sleep(1)
#         t = str(time.clock())
#         print('In background_stuff', t)
#         #socketio.emit('message', {'data': 'This is data', 'time': t}, namespace='/test')
#
#@app.route('/test')
#def index():
#    print('directly')
#    t = str(time.clock())
#    socketio.emit('message', {'data': 'This is data', 'time': t}, namespace='/test2')
#    #global thread
#    #if thread is None:
#    #    thread = Thread(target=background_stuff)
#    #    thread.start()
#    return "test"
#    #return render_template('index.html')


#def messageReceived(methods=['GET', 'POST']):
#    print('message was received!!!')

#def my_function_handler(data):
#    pass
#
#socketio.on_event('my event', my_function_handler, namespace='/test')
#@socketio.on('my event')
#def handle_my_custom_event(json, methods=['GET', 'POST']):
#    print('received my event: ' + str(json))
#    socketio.emit('my response', json, callback=messageReceived)


#def socketio_stuff():
#    socketio.run(app, debug=IS_DEBUG)
#
#if thread is None:
#    thread = Thread(target=socketio_stuff)
#    thread.start()
#socketio.run(app, host='0.0.0.0', port=8000,  threaded=True)
#socketio.run(app, host='0.0.0.0', port=8080, debug=IS_DEBUG)
def create_app():
    return socketio

if IS_DEBUG:
    app.run(host="0.0.0.0", port=8080, debug=IS_DEBUG)
else:
    socketio.run(app, host='0.0.0.0', port=8080, debug=IS_DEBUG)
    #socketio.run(app)
    #app.run()
    pass
