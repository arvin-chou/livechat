from app import app, socketio
import time
from threading import Thread
from flask import Flask, render_template, session, request

thread = None
def background_stuff():
     """ python code in main.py """
     print('In background_stuff')
     while True:
         time.sleep(1)
         t = str(time.clock())
         socketio.emit('message', {'data': 'This is data', 'time': t}, namespace='/test')

@app.route('/test')
def index():
    print('directly')
    t = str(time.clock())
    socketio.emit('message', {'data': 'This is data', 'time': t}, namespace='/test2')
    #global thread
    #if thread is None:
    #    thread = Thread(target=background_stuff)
    #    thread.start()
    return "test"
    #return render_template('index.html')


#def messageReceived(methods=['GET', 'POST']):
#    print('message was received!!!')

def my_function_handler(data):
    pass

socketio.on_event('my event', my_function_handler, namespace='/test')
#@socketio.on('my event')
#def handle_my_custom_event(json, methods=['GET', 'POST']):
#    print('received my event: ' + str(json))
#    socketio.emit('my response', json, callback=messageReceived)


#socketio.run(app, host='0.0.0.0', port=8000,  threaded=True)
socketio.run(app, host='0.0.0.0', port=8080, debug=True)
#app.run(host="0.0.0.0", port=8080, debug=True)
