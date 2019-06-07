from flask_appbuilder import IndexView
class MyIndexView(IndexView):
    index_template = 'new_index.html'
