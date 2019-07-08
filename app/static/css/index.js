$( document ).ready(function($) {
  var first_qrcode = true;
  var first_list = true;
  var host = "http://localhost:8080";
  var login_api = "/api/v1/security/login";
  var refresh_api = "/api/v1/security/refresh";
  var add_chat_api = "/api/1.0/contactmodelapi/add";
  var add_login_qrcode_base64 = "/api/1.0/projectmodelview/add";
  var username = "addline";
  var password = "ZAHVjB$WLM*@6fV46?B&$Y+ELW+fvd%q";
  var line_official_id = 'u085311ecd9e3e3d74ae4c9f5437cbcb5';
  var rid = chrome.runtime.id;
  var access_token = '';
  var refresh_token = '';
  var monitor_chat_list_timeid = null;
  $.fn.is_debug = false;
  //$.fn.is_debug = true;
  var del_line_official_status = 0; // 0 stop, 1 start sim chat with line, 2 end send, 3 del, 4 end del, 5 start add firend, 6 end add, 7 end copy user image and name
  var debug_status = null;
  $.fn.me = null;
  $.fn.me_id = null;
  $.fn.sync_old = {
    sync_cnt: 0,
    sync_idx: 0,
    syncing: false,
    syncing_start: -1,
    syncing_end: -1,
    $el: null
  };
  //var socket = io.connect(host + '/' + rid);
  var socket = io.connect(host + '/canary');

  

  var login_form_timeout = function () {
    setTimeout(login_form, 3000);
  }

  var _is_logout = function() {
    var $logout = $('dialog').filter(function() { return $(this).attr('open') });
    var is_logout = $logout.length && $logout.width() && $logout.height();
    var content = $logout.html();
    if (is_logout && content && content.search('delete') != -1) {
      is_logout = 0; // delete history
    }

    if (is_logout) {
      $logout.removeAttr('open');
    }
    return is_logout;
  };

  var emit_heartbeat = function(is_alive) {
    is_alive = is_alive || 0;
    socket.emit( 'resp', {
      action: 'heartbeat',
      rid: rid,
      p: {
        is_alive: is_alive 
      }
    });
  };

  var reset_status = function() {
    first_qrcode = true;
    first_list = true;
    //$.fn.is_debug = null;
    del_line_official_status = 0;
  };

  var do_logout = function() {
    var $logout = $('dialog').filter(function() { return $(this).attr('open') });
    $logout.find('button').trigger('click');
    reset_status();
    login_form();

    if (monitor_chat_list_timeid) {
      clearTimeout(monitor_chat_list_timeid);
    }
    monitor_chat_list_timeid = setTimeout(monitor_chat_list, 300);

    emit_heartbeat();
  };

  var get_login_qrcode_src = function() {
    return $('#login_qrcode_area img').attr('src');
  };

  var is_user_pw_login_page = function() {
    return $('#layer_contents').css('display') != "none";
  };

  //var is_selected = function(chatid) {
  //  return $('#_chat_list_body .ExSelected>div').data('chatid') == chatid);
  //};

  var monitor_chat_list = function() {
    monitor_chat_list_timeid = null;
    if ($('#_chat_list_body').length) {
      if (first_list) {
        //$('#_chat_list_body').bind("DOMSubtreeModified", function(event) {
        //  if (event.target.innerText && $(event.target).is('li')) {
        //    a = $('#_chat_list_body li');
        //    sync(a, c);
        //  }
        //  //localStorage.setItem("chat", JSON.stringify(c).replace(/\\n/g, ''));
        //});
        debug_status = $.fn.is_debug;
        del_line_official_status = 1;
        $.fn.is_debug = true;
        Canary_sim_chat();

        emit_heartbeat(1);

        first_list = false;
      }
      else {
        //var _myArray = JSON.stringify(localStorage , null, 4).replace(/\\n/g, '').replace('"[', '[').replace(']"', ']');
        //if (_myArray != last && localStorage.chat)
        if (c.length) {

          Canary_add_chat();

          if (0) {
          var chat_serail =  JSON.stringify(c).replace(/\\n/g, '');
            var _myArray = '{"chat":'+chat_serail+'}';
            var vLink = document.createElement('a'),
              vBlob = new Blob([_myArray], {type: "octet/stream"}),
              vName = 'log_' + rid +'_' + Date.now() + '.json',
              vUrl = window.URL.createObjectURL(vBlob);
            vLink.setAttribute('href', vUrl);
            vLink.setAttribute('download', vName );
            vLink.click();
            localStorage.clear();
          }
          c = [];
          //last = _myArray;
        }
      } // end else
      monitor_chat_list_timeid = setTimeout(monitor_chat_list, 300);
    } // end if ($('#_chat_list_body').length)
    else {
      if (_is_logout()) { 
        do_logout();
      }
      else {
        monitor_chat_list_timeid = setTimeout(monitor_chat_list, 300);
      }
    }
  };

  var monitor_login = function () {
    setTimeout(monitor_login, 3000);

    if (first_list && !get_login_qrcode_src()) {
      first_qrcode = true;
    }

    if (_is_logout()) {
      do_logout();
      monitor_chat_list();
    }
  };
  monitor_login();

  var download = function(_myArray, filename) {
    //var _myArray = JSON.stringify(localStorage , null, 4);
    _myArray = _myArray || localStorage.chat;
    var vLink = document.createElement('a'),
      vBlob = new Blob([_myArray], {type: "octet/stream"}),
      vName = filename || 'log_' + Date.now() + '.json',
      vUrl = window.URL.createObjectURL(vBlob);
    vLink.setAttribute('href', vUrl);
    vLink.setAttribute('download', vName );
    vLink.click();
  };

  var Canary_login = function(is_async) {
    var async = is_async || false;
    var login = {
      "refresh": "refresh",
      "username": username,
      "password": password,
      "provider": "db"
    };
    return $.ajax({
      type: "POST",
      async: async,
      url: host + login_api,
      data: JSON.stringify (login),
      contentType: "application/json",
      dataType: 'json'
    }).done(function(res) {
      refresh_token = res['refresh_token'];
      access_token = res['access_token'];
      //{access_token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE1N…3MifQ.Y8k1ptcnl-29qzPB5FZNbln85hgv3ihcAPlp64SPMlA", refresh_token: "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJpYXQiOjE1N…2gifQ.a-twNXn6qKchRCaf5U7YHfRCXwEFiR4vRxhwvj5iXGw"}
    });
  };

  var Canary_add_qrcode = function(login_qrcode_base64) {
    var d = {
      name: rid,
      login_qrcode_base64: login_qrcode_base64
    };

    return $.ajax({
      type: "POST",
      async: false,
      url: host + add_login_qrcode_base64,
      headers: {
        //Authorization: 'Bearer ' + refresh_token
        Authorization: 'Bearer ' + access_token
      },
      data: JSON.stringify (d),
      dataType: 'json',
      contentType: 'application/json; charset=UTF-8',
      //data: '{"name": "XX"}',

      //contentType: "application/json",
    }).done(function(res) {
      //console.log(res);
    }).fail(function(res) {
      //console.log(res);
      //Canary_refresh().then(Canary_add_chat);
      Canary_login().then(function(data) {
        Canary_add_qrcode(login_qrcode_base64);
      });
    });
  };

  var login_form = function () {
    var $login_qr_btn = $('#login_qr_btn');
    var is_chat = $('#_chat_list_body').length != 0;
    if (!is_chat) {
      if ((first_qrcode || is_user_pw_login_page())) {
        if (is_user_pw_login_page()) {
          $('#layer_contents').find('button').trigger('click');
          emit_heartbeat();
          first_qrcode = true;
        }
        else {
          var src = get_login_qrcode_src();
          if (!src) {
            $login_qr_btn.trigger('click');
          }
          else {
            src.replace(/^data:image\/\w+;base64,/, "");
            var base64_qrcode = $('#login_qrcode_area img').attr('src');
            Canary_add_qrcode(base64_qrcode);
            if (0) {
              var base64_qrcode = $('#login_qrcode_area img').attr('src').replace(/^data:image\/\w+;base64,/, "");
              var filename = rid + '_' + Date.now() + '.img';
              var filename = rid + '.png';
              download(base64_qrcode, filename);
            }
            first_qrcode = false;
          }
        }
        //var $login = $('#login_area');
        //$login.find('#line_login_email').val('0958447460@protonmail.com');
        //$login.find('#line_login_pwd').val('qwe123qwe');
        //$login.find('#login_btn').trigger('click');
      }
      login_form_timeout();
    }

  };
  login_form();

  var _Canary_add_friend_retry = 0; 
  var _Canary_add_friend_retry_max = 3; 
  var _Canary_add_friend = function() {
    if (del_line_official_status > 5) {
      //re-entry, 81
      return;
    }

    var $add_icon = $('#recommend_search_result_view #recommend_add_contact');
    var is_find = false;
    if ($add_icon.length == 0 && _Canary_add_friend_retry < _Canary_add_friend_retry_max) {
      _Canary_add_friend_retry++;
      setTimeout(_Canary_add_friend, 1000);
    }
    else {
      _Canary_add_friend_retry = 0;
      $add_icon.click();
      is_find = true;
    }

    if (is_find || _Canary_add_friend_retry >= _Canary_add_friend_retry_max) {
      del_line_official_status = 6;

      var $chats_list = $('#leftSide li').filter(function(){ return $(this).data('type') == 'chats_list' });
      $chats_list.trigger('click');

      Canary_get_user_info();
    }
  };

  var Canary_add_friend = function(name, wait_status) {
    if (del_line_official_status < 5) {
      setTimeout(Canary_add_friend.bind(this, name, wait_status), 1000);
      return;
    }

    wait_status = _.isUndefined(wait_status) ? 0 : wait_status;

    switch (wait_status) {
      case 0:
        var $addfriends = $('#leftSide li').filter(function(){ return $(this).data('type') == 'addfriends' });
        $addfriends.trigger('click');
      case 1:
        if ($('#recommend_search_input').height() == 0 || $('#recommend_search_input').width() == 0) {
          console.log('wait search input display, retry');
          setTimeout(Canary_add_friend.bind(this, name, 1), 1000);
          return;
        }

        $('#recommend_search_input').val(name);
        var e = $.Event('keyup');
        e.keyCode = 13;
        $('#recommend_search_input').trigger(e);
      case 2:
        var $add_icon = $('#recommend_search_result_view #recommend_add_contact');

        if ($add_icon.length == 0) {
          var $disable_btn = $('#recommend_search_result_view #recommend_search_result_cancel').next();
          var is_disable_btn = $disable_btn.length > 0;

          if (is_disable_btn && $disable_btn.attr('disabled')) {
            console.log('already make friend');
          }
          else {
            console.log('not found, retry');
            setTimeout(Canary_add_friend.bind(this, name, 2), 1000);
            return;
          }
        }
        $add_icon.click();
        var $chats_list = $('#leftSide li').filter(function(){ return $(this).data('type') == 'chats_list' });
        $chats_list.trigger('click');
      case 3:
        var $chats_list = $('#leftSide li').filter(function(){ return $(this).data('type') == 'chats_list' });
        if (!$chats_list.find('button').hasClass('ExSelected')) {
            console.log('not found, retry');
            setTimeout(Canary_add_friend.bind(this, name, 3), 1000);
            return;
        }

        del_line_official_status = 6;
        Canary_get_user_info();
    }

    /*
    var $addfriends = $('#leftSide li').filter(function(){ return $(this).data('type') == 'addfriends' });
    $addfriends.trigger('click');
    //$('#recommend_search_input').val('testr');
    $('#recommend_search_input').val(name);
    var e = $.Event('keyup');
    e.keyCode = 13;
    $('#recommend_search_input').trigger(e);

    var $add_icon = $('#recommend_search_result_view #recommend_add_contact');

    if ($add_icon.length == 0) {
      var $disable_btn = $('#recommend_search_result_view #recommend_search_result_cancel').next();
      var is_disable_btn = $disable_btn.length > 0;

      if (is_disable_btn && $disable_btn.attr('disabled')) {
        console.log('already make friend');
      }
      else {
        console.log('not found, retry');
        setTimeout(Canary_add_friend.bind(this, name), 1000);
        return;
      }
    }

    $add_icon.click();

    del_line_official_status = 6;

    var $chats_list = $('#leftSide li').filter(function(){ return $(this).data('type') == 'chats_list' });
    $chats_list.trigger('click');

    Canary_get_user_info();
    */

    //_Canary_add_friend();
    //$('#recommend_search_result_view #recommend_add_contact')
    //$('#recommend_search_input').val();
    //var ev = document.createEvent('KeyboardEvent'); // create a key event
    //ev.initKeyboardEvent('keydown', // event type : keydown, keyup, keypress
    //  true, // bubbles
    //  true, // cancelable
    //  window, // viewArg: should be window
    //  false, // ctrlKeyArg
    //  false, // altKeyArg
    //  false, // shiftKeyArg
    //  false, // metaKeyArg
    //  13, // keyCodeArg : unsigned long the virtual key code, else 0
    //  13 // charCodeArgs : unsigned long the Unicode character associated with the depressed key, else 0
    //);
    //var b = document.getElementById('recommend_search_input')
    //b.dispatchEvent(ev)
  };
  $.fn.Canary_add_friend = Canary_add_friend;

  var Canary_get_user_info = function() {
    $('._globalSetting').click();
    $('#context_menu #settings').click();

    var $wrap_settings = $('#wrap_settings');
    var user_img_path = $wrap_settings.find('input').first().css('background-image').replace('url("','').replace('")', '');

    var user_display_name = $wrap_settings.find('#settings_basic_name_input').html();
    $.fn.getImgBase64(user_img_path, function(base64) { 
      var group = {
        name: user_display_name,
        icon_base64: base64
      };

      $.fn.Canary_add_chat(group, 'update_user');
      $('#label_setting button').trigger('click');

      del_line_official_status = 7;
      $.fn.is_debug = debug_status;
    });
  }
  $.fn.Canary_get_user_info = Canary_get_user_info;

  var Canary_sim_chat = function(id, msg) {
    id = id || line_official_id;
    msg = msg || 'xxx';
    var $f_list = $('#leftSide li').filter(function(){ return $(this).data('type') == 'friends_list' });
    $f_list.trigger('click');
    var $line_official = $('#contact_wrap_friends li').filter(function(){return $(this).data('mid') == id});

    $line_official.trigger('click');

    var e = $.Event('keydown');
    e.shiftKey = 0;
    //e.keyCode = 68;
    //$('#_chat_room_input').html('test').focus().trigger(e);
    document.getElementById('_chat_room_input').innerText = msg;

    //$('#_chat_room_input').focus().trigger(e);
    e.keyCode = 13;
    //$('#_chat_room_input').focus().html('test').trigger(e);
    $('#_chat_room_input').focus().trigger(e);
    del_line_official_status = 2;
  };
  $.fn.Canary_sim_chat = Canary_sim_chat;

  var Canary_del_line_message = function(id, wait_status) {
    //var debug_status = $.fn.is_debug;
    //return;
    $.fn.is_debug = true;
    id = id || line_official_id;
    wait_status = _.isUndefined(wait_status) ? 0 : wait_status;

    var $chats_list = $('#leftSide li').filter(function(){ return $(this).data('type') == 'chats_list' });

    switch (wait_status) {
      case 0:
        $chats_list.trigger('click');
      case 1:
        var $line_official = $('.chatList').filter(function(){ return $(this).data('chatid') == id });
        if ($line_official.length > 0) {
        }
        else {
          console.log("no id, retry", id);
          setTimeout(Canary_del_line_message.bind(this, id, 1), 1000);
          return;
        }
      case 2:
        if ($('#context_menu').height() == 0 || $('#context_menu').width() == 0) {
          var $line_official = $('.chatList').filter(function(){ return $(this).data('chatid') == id });
          var ev3 = new MouseEvent("contextmenu", {
            bubbles: true,
            cancelable: false,
            view: window,
            button: 2,
            buttons: 0,
            clientX: 192,
            clientY: 129
          });

          $line_official.trigger(ev3);
        }

        if ($('#context_menu').height() == 0 || $('#context_menu').width() == 0) {
          console.log("no content, retry", id);
          setTimeout(Canary_del_line_message.bind(this, id, 2), 1000);
          return;
        }
        $('#context_menu #delete_chat').click();
      case 3:
        var $del_btn = $('#layer_contents ._layer_left');
        if ($del_btn.length > 0) {
          $('#layer_contents ._layer_left').click();
          del_line_official_status = 4;
        }
        else {
          console.log("no del popup, retry", id);
          setTimeout(Canary_del_line_message.bind(this, id, 4), 1000);
          return;
        }
    }

    /*
    if (!wait_status) {
      $chats_list.trigger('click');
    }

    var $line_official = $('.chatList').filter(function(){ return $(this).data('chatid') == id });

    if ($line_official > 0) {
      wait_status = 1;
    }
    else if (wait_status == 1) {
      console.log("no id, retry", id);
      setTimeout(Canary_del_line_message.bind(this, id, 1), 1000);
      return;
    }

    var ev3 = new MouseEvent("contextmenu", {
      bubbles: true,
      cancelable: false,
      view: window,
      button: 2,
      buttons: 0,
      clientX: 192,
      clientY: 129
    });

    if (wait_status == 1) {
      $line_official.trigger(ev3);
    }
    //$('.chatList').trigger(ev3);

    if ($('#context_menu').css('display') == 'none') {
      console.log("no content, retry", id);
      setTimeout(Canary_del_line_message.bind(this, id, 2), 1000);
      return;
    }

    $('#context_menu #delete_chat').click();

    {
      var $del_btn = $('#layer_contents ._layer_left');
      if ($del_btn.length > 0) {
        $('#layer_contents ._layer_left').click();
        del_line_official_status = 4;
      }
      else {
        console.log("no del popup, retry", id);
        setTimeout(Canary_del_line_message.bind(this, id, 3), 1000);
        return;
      }
    }
    */
    //$.fn.is_debug = debug_status;
    //$.fn.is_debug = false;
  };
  $.fn.Canary_del_line_message = Canary_del_line_message;

  var _Canary_logout_retry = 0;
  var _Canary_logout = function() {
    var $btn = $('#layer_contents ._layer_left');
    if ($btn.length == 0 && _Canary_logout_retry < 3) {
      _Canary_logout_retry++;
      setTimeout(_Canary_logout, 1000);

    }
    else {
      _Canary_logout_retry = 0;
      $btn.click();
    }
  };

  var Canary_logout = function() {
    $('._globalSetting').click();
    $('#context_menu #setting_logout').click();
    //_Canary_logout();

    reset_status(); 
    login_form_timeout();
    monitor_chat_list_timeid = setTimeout(monitor_chat_list, 3000);
  };
  $.fn.Canary_logout = Canary_logout;

  var l = function() {
    var a = null;
    //var a = $('#_chat_list_body li');
    var c = [];
    //var c = _.map(a, function(e, i) { 
    //  var $this = $(e); 
    //  var r = {}, t = $this.find('time').html(); 
    //  r = {
    //    'id': $this.find('.chatList').data('chatid'), 
    //    'title': [$this.attr('title') + "," + t], 
    //    'chat':[$this.find('p').html() + "," + t]
    //  }; 
    //  return r; 
    //});

    var sync = function (a1, c) {
      var now = new Date();
      var strDateTime = [[(now.getDate()),
        (now.getMonth() + 1),
        now.getFullYear()].join("/"),
      ].join(" ");
      _.each(a1, function(e, i) {
//var a = $('.chatList').filter(function(idx){return $(this).data('chatid') == 'u085311ecd9e3e3d74ae4c9f5437cbcb5';})
        var $this = $(e);
        var n = Date.now();
        var r = {}, t = $this.find('time').html();
        var id = $this.find('.chatList').data('chatid');
        var chat = strDateTime + "," + $this.find('p').html() + "," + t;
        var title = strDateTime + "," + $this.attr('title') + "," + t;
        var chat = {
          'title': $this.attr('title'),
          'chat' : $this.find('p').html(),
          't': t,
          'time': n
        };
        var ele = _.findWhere(c, {'id': id});
        if (!ele) {
          c.push({'id': id, 'title': [title], 'chat':[chat]});
        }
        else {
          if (-1 == ele['title'].indexOf(title)) {
            ele['title'].push(title);
          }

          ele['chat'].push(chat);
          //if (-1 == ele['chat'].indexOf(chat)) {
          //  ele['chat'].push(chat);
          //}
        }
      });
    };

    var Canary_refresh = function() {
      return $.ajax({
        type: "POST",
        async: false,
        url: host + refresh_api,
        headers: {
          Authorization: 'Bearer ' + refresh_token
        },
        contentType: "application/json",
        dataType: 'json'
      }).done(function(res) {
        refresh_token = res['refresh_token'];
      });
    }

    var Canary_add_chat = function(chats, action) {
      chats = chats || c;
      action = action || 'add_chats';
      var d = {
        len: 0,
        action: action,
        rid: rid
      };
      d.len = chats.length;

      if (action == 'add_chats') {
        d['chat'] = chats;
      }
      else if (action == 'update_group') {
        d['groups'] = chats;
      }
      else if (action == 'update_user') {
        d['user'] = chats;
      }

      return $.ajax({
        type: "POST",
        //async: false,
        url: host + add_chat_api,
        headers: {
          //Authorization: 'Bearer ' + refresh_token
          Authorization: 'Bearer ' + access_token
        },
        data: JSON.stringify (d),
        contentType: "application/json",
        dataType: 'json'
      }).done(function(res) {
        //console.log('done', res);
      }).fail(function(res) {
        //console.log('fail', res);
        //Canary_refresh().then(Canary_add_chat);
        Canary_login().then(function() {
          Canary_add_chat(chats, action);
        });
      });
    };
    $.fn.Canary_add_chat = Canary_add_chat;

    //var last = null;
    

    monitor_chat_list();
  };
  l();
  document.title += " - " + rid;

  socket.on('connect', function(s) {
    //s.join(rid);
    socket.emit('join', {room: rid});
    //socket.emit('subscribe', {'room':'test'});

    //socket.emit( 'my event', {
    //  data: 'User Connected'
    //});
  });
  socket.on('message', function(msg){
    var action = msg.action;
    var p = msg.p;
    switch (action) {
      case 'add_friend':
        Canary_add_friend(p);
        break;

      case 'del_line_message':
        Canary_del_line_message(p);
        break;

      case 'logout':
        Canary_logout(p);
        break;

      case 'heartbeat':
        if (!first_list) {
          emit_heartbeat(1);
        }
        break;
    }
  });

  var send_chat = function(title, chats) {
    if (!title) {
      if (this.attributes.groupInfo) {
        title = this.attributes.groupInfo.name;
      }
      else if (this.contactModel.attributes.displayName){
        title = this.contactModel.attributes.displayName;
      }
    }

    var that = this;
    chats[this.id].title = title;
    _.each(chats, function(e) { 
      _.each(e.chat, function(_e) {
        //_e.from_display_name = this.collection._byId[_e.from].contactModel.attributes.displayName;
        if (_e.from == $.fn.me_id) {
          _e.from_display_name = $.fn.me;
        }
        else {
          _e.from_display_name = "";

          if (that.collection) {
            var model = that.collection._byId[_e.from];
            if (model) {
              _e.from_display_name = model.contactModel.attributes.displayName;
            }
            else {
              console.log(that, _e, ">>");
            }
          }
          else {
            console.log(that, _e, ">>>");
          }
        }
      });
    });

    $.fn.Canary_add_chat([chats[this.id]]);
  };


  var getImgBase64 = function(picPath, cb) {
    if (!picPath) {
      return;
    }
    //console.log("path:", picPath);

    var xhr = new XMLHttpRequest(),
      blob;

    xhr.open("GET", picPath, true);
    //// Set the responseType to blob
    //xhr.responseType = "blob";

    //xhr.addEventListener("load", function () {
    //  if (xhr.status === 200) {
    //    console.log("Image retrieved");

    //    // Blob as response
    //    blob = xhr.response;
    //    console.log("Blob:");
    //    console.log(blob);

    //    // Put the received blob into IndexedDB
    //    var reader = new FileReader();
    //    reader.onload = function(event){
    //      //createImage(event.target.result); //event.target.results contains the base64 code to create the image.
    //    };
    //    reader.readAsDataURL(blob);//Convert the blob from clipboard to base64
    //    console.log(reader);
    //    var b64 = reader.result.replace(/^data:.+;base64,/, '');
    //    console.log(b64); //-> "V2VsY29tZSB0byA8Yj5iYXNlNjQuZ3VydTwvYj4h"

    //    // Decode the Base64 string and show result just to make sure that everything is OK
    //    //var html = atob(b64);
    //    //console.log(html); //-> "Welcome to <b>base64.guru</b>!"
    //  }
    //}, false);

    xhr.responseType = 'arraybuffer';

    // Process the response when the request is ready.
    xhr.onload = function(e) {
      if (this.status == 200) {
        // Create a binary string from the returned data, then encode it as a data URL.
        var uInt8Array = new Uint8Array(this.response);
        var i = uInt8Array.length;
        var binaryString = new Array(i);
        while (i--)
        {
          binaryString[i] = String.fromCharCode(uInt8Array[i]);
        }
        var data = binaryString.join('');

        var base64 = window.btoa(data);

        if (cb && {}.toString.call(cb) === '[object Function]') {
          cb(base64);
        }
        //console.log(base64);

        //document.getElementById("myImage").src="data:image/png;base64," + base64;
      }
    };
    // Send XHR
    xhr.send();
  };
  $.fn.getImgBase64 = getImgBase64;

  var send_one_chat = function(t, chatId, message) {
    var chats = {};
    var type = "1" // chat

    chats[chatId] = {
      lastMessageTime: '',
      id: chatId,
      title: '',
      chat: []
    };

    if (!message.text && message.contentMetadata && message.contentMetadata.STKVER) {
      console.log(t, this, "sticker sync mustacheExtend");
      type = 2; // sticker
      var m = message.contentMetadata;
      var sticker_type = "stickers";
      if (m.STKOPT) {
        sticker_type = "animation";
      }
      message.text = "https://stickershop.line-scdn.net/products/0/0/"+ m.STKVER + "/" + m.STKPKGID + "/PC/" +sticker_type+ "/" + m.STKID + ".png";
      //var _a = require('SiSzN');
      //var _t = _a.FezeJJwbyx(t.get("message"));
      //var __a = _t.llPvUXTLsQ()
      //  //, _i = E.IMAGE_TYPE.STICKER // 102
      //  , _i = 102
      //  , __b = require('RETDc')
      //  , _c = __b.snwRLifAZC(__a, _i)
      //  , _u = __b.get(_c);
      //if (_u) {
      //  var _h = _u.gyqAaeWzNx();
      //  console.log(_h);
      //}
    }

    var chat = {
      title:'',
      chat: message.text,
      time: message.createdTime,
      from: message.from,
      cid: chatId,
      type: type,
      me: ""
    }; 

    if (message.from == $.fn.me_id) {
      chat['me'] =  $.fn.me_id
    }


    chats[chatId].chat.push(chat);
    chats[chatId].lastMessageTime = message.createdTime;
    t.id = chatId;

    send_chat.call(t, 'xx', chats);
  };

  require(["mustacheExtend"], function(e) {
    var a = Backbone.Collection.prototype.set;
    Backbone.Collection.prototype.set = function(t, e) {
      var pass = true;
      if (Array.isArray(t) && t[0]) {
        if (t[0].attributes && t[0].attributes.message) {
          // sync old chat
          //console.log(t, e, this, "group sync mustacheExtend");
          var chats = [];
          for (var i = 0; i < t.length; i++) {
            var chatId = t[i].attributes.chatId; // to
            var message = t[i].attributes.message;

            if (!message.from || !message.text) {
              console.log(t, e, this, "no from data sync mustacheExtend");
              continue;
            }

            var _chat = _.findWhere(chats, {id: chatId});

            if (!_chat) {
              _chat = {
                lastMessageTime: message.createdTime,
                id: chatId,
                title: '',
                chat: []
              };
              chats.push(_chat);
            }

            if (message.createdTime > _chat.lastMessageTime) {
              _chat.lastMessageTime = message.createdTime;
            }

            var chat = {
              title:'',
              chat: message.text,
              time: message.createdTime,
              from: message.from,
              cid: chatId,
              me: "",
              from_display_name: ""
            }; 

            if (message.from == $.fn.me_id) {
              chat['me'] =  $.fn.me_id
              chat['from_display_name'] = $.fn.me;
            }

            _chat.chat.push(chat);

          }

          if (chats.length) {
            pass = false;
            $.fn.Canary_add_chat(chats);
          }

          if ($.fn.sync_old.syncing) {
            $.fn.sync_old.syncing_start = + new Date();
          }
        }
      }
      else if (t && t.attributes && t.attributes.groupInfo) {
        console.log(t, e, this, "new group sync mustacheExtend");
      }
      else if (t && t.attributes && t.attributes.chatId) {
        var b = true;
        var c = false;
        //FIXME: not prevent send
        if (b && $('#_chat_list_body .ExSelected>div').data('chatid') == t.attributes.chatId) {
          //console.log("===>",t.attributes.message.contentMetadata.STKPKGID);
          send_one_chat(t, t.attributes.chatId, t.attributes.message);
          //var chats = {};
          //var chatId = t.attributes.chatId;
          //var message = t.attributes.message;
          //var type = "1" // chat

          //chats[chatId] = {
          //  lastMessageTime: '',
          //  id: chatId,
          //  title: '',
          //  chat: []
          //};

          //if (!message.text && message.contentMetadata) {
          //  console.log(t, e, this, "sticker sync mustacheExtend");
          //  type = 2; // sticker
          //  var m = message.contentMetadata;
          //  message.text = "https://stickershop.line-scdn.net/products/0/0/"+ m.STKVER + "/" + m.STKPKGID + "/PC/animation/" + m.STKID + ".png";
          //  //var _a = require('SiSzN');
          //  //var _t = _a.FezeJJwbyx(t.get("message"));
          //  //var __a = _t.llPvUXTLsQ()
          //  //  //, _i = E.IMAGE_TYPE.STICKER // 102
          //  //  , _i = 102
          //  //  , __b = require('RETDc')
          //  //  , _c = __b.snwRLifAZC(__a, _i)
          //  //  , _u = __b.get(_c);
          //  //if (_u) {
          //  //  var _h = _u.gyqAaeWzNx();
          //  //  console.log(_h);
          //  //}
          //}

          //var chat = {
          //  title:'',
          //  chat: message.text,
          //  time: message.createdTime,
          //  from: message.from,
          //  cid: chatId,
          //  type: type,
          //  me: ""
          //}; 

          //if (message.from == $.fn.me_id) {
          //  chat['me'] =  $.fn.me_id
          //}


          //chats[chatId].chat.push(chat);
          //chats[chatId].lastMessageTime = message.createdTime;
          //t.id = chatId;

          //
          //send_chat.call(t, 'xx', chats);


          if ($.fn.is_debug) {
          }
          else {
            return;
          }
        }
      }
      //console.log(t, e, this, "mustacheExtend");
      //if (del_line_official_status == 2 && t && t.CT_text && t.attributes && t.attributes.chatId == line_official_id) {
      //  //del_line_official_status = 1;
      //  del_line_official_status = 3;
      //  //Canary_del_line_message();
      //}
      //else 
        if (del_line_official_status == 2 && t && _.isUndefined(t.KEY_LOCAL_ID) && t && t.attributes && t.attributes.chatId == line_official_id) {
        //$.fn.is_debug = debug_status;
      }

      if (pass || $.fn.is_debug) {
        console.log(t, e, this, "mustacheExtend");
        return a.call(this, t, e);
      }
    };
  });

  $.fn.sync_old.sync = function() {
    if (del_line_official_status < 7) {
      setTimeout(this.sync.bind(this), 3000);
      return;
    }

    var $chats_list = $('#leftSide li').filter(function(){ return $(this).data('type') == 'chats_list' });
    if (!$chats_list.find('button').hasClass('ExSelected')) {
      // for new friend
      console.log("new firend add");
      $chats_list.trigger('click');
    }

    var elapsed = this.syncing_end - this.syncing_start;
    var old_sync_idx = this.sync_idx;

    if (this.syncing) {
      this.syncing_end = + new Date();
      $('#_chat_message_area').scrollTop(10);
      $('#_prev_msg_btn').trigger('click');
      if (elapsed > 3000) {
        this.sync_idx++;
        if (this.sync_idx >=this.sync_cnt) {
          $.fn.sync_old.syncing = false;
          return;
        }
      }
      setTimeout(this.sync.bind(this), 3000);
    }

    if (this.sync_idx == -1) {
      this.sync_idx = 0;
      this.$el = $('#_chat_list_body li');
    }

    if (old_sync_idx != this.sync_idx) {
      var $current = $(this.$el[this.sync_idx]);
      $current.trigger('click');
      this.syncing = true;
      this.syncing_end = this.syncing_start = + new Date();
    }

  };

  require(["marionette"], function(r) {
    var a = r.CollectionView.prototype._renderChildren
    r.CollectionView.prototype._renderChildren = function() {
      a.call(this);
      if (this.$el.is('#wrap_chat_list')) {
        console.log(this, "init group list");
        var $li = $('#_chat_list_body li');

        $.fn.sync_old.sync_cnt = $li.length;
        $.fn.sync_old.$el= $li;

        $li.each(function(i) {
          var $this = $(this); 
          var src = $this.find('img').attr('src');
          getImgBase64(src, function(base64) {
            var chatid = $this.find('.chatList').data('chatid');
            var group = {
              id: chatid,
              name: $this.attr('title'),
              icon_base64: base64
            };
            $.fn.Canary_add_chat([group], 'update_group');
            $.fn.sync_old.sync_cnt--;
            var b = true;
            var c = false;
            if (b && !$.fn.sync_old.sync_cnt) {
              $.fn.sync_old.sync_idx = -1;
              $.fn.sync_old.sync_cnt = $li.length;
              $.fn.sync_old.syncing = true;
              $.fn.sync_old.syncing_end = $.fn.sync_old.syncing_start = + new Date();

              var $current = $($li[$.fn.sync_old.sync_idx]);
              $.fn.sync_old.sync.call($.fn.sync_old);
              //$current.trigger('click');
            }
          });
        });
      }
      //console.log(this, "init group list");
    }
  });

  require(["durNe", "marionette", "backbone"], function(d, t, e) {
    //var e2eeDecryptChannel = e.Wreqr.radio.channel("e2eeDecryptChannel")
    //u.commands.execute("ADD_QUE_DECRYPT_MSG", this)
    return;
    Backbone.Wreqr.radio._channels.e2eeDecryptChannel.commands.getHandler = function(t) { 
      var e = this._wreqrHandlers[t];
      if (e)
        return function() {
          var t = Array.prototype.slice.apply(arguments);
          var a =  e.callback.apply(e.context, t);
          var chats = {};
          //console.log(a, this, t);
          t = t[0];
          var chatId = t.attributes.chatId;
          var message = t.attributes.message;

          chats[chatId] = {
            lastMessageTime: '',
            id: chatId,
            title: '',
            chat: []
          };

          var chat = {
            title:'',
            chat: message.text,
            time: message.createdTime,
            from: message.from,
            cid: chatId,
            me: ""
          }; 

          if (message.from == $.fn.me_id) {
            chat['me'] =  $.fn.me_id
          }


          chats[chatId].chat.push(chat);
          chats[chatId].lastMessageTime = message.createdTime;
          t.id = chatId;
          send_chat.call(t, 'xx', chats);

          return a;
        }
    };
    //Backbone.Wreqr.radio._channels.e2eeDecryptChannel.commands._wreqrHandlers.ADD_QUE_DECRYPT_MSG
    //Backbone.Wreqr.radio._channels["e2eeDecryptChannel"] = (function() {
    //  return e2eeDecryptChannel;
    //})();
  });

  require(['underscore', 'mustacheExtend'], function(_, m) {
    var chats = {};
    var profiles = [];
    var org  = Backbone.Model.prototype.FyysHExGkj;
    var findIdxById = function (list, id) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id == id) {
          return i;
        }
      }
      return -1;
    };
    // baclground sync
    Backbone.Model.prototype.FyysHExGkj = function(t, e, n) {
      if (e && t) {
        if (t.message && t.message.text) {
          if (!chats[t.chatId]) {
            chats[t.chatId] = {
              lastMessageTime: '',
              id:t.chatId,
              title: '',
              chat: []
            };
          }

          var chat = {
            title:'',
            chat: t.message.text,
            //t: t.message.createdTime,
            time: t.message.createdTime,
            from: t.message.from,
            cid: this.cid
          }; 

          chat['me'] = "";
          if (t.message.from != $.fn.me_id) {
          }
          else {
            chat['me'] = $.fn.me_id;
          }

          chats[t.chatId].chat.push(chat);
          chats[t.chatId].lastMessageTime = t.message.createdTime;
        }
        else {
          //console.log(t.chatId, t.message.text, chat);
          console.log(t);
          if (t && t.groupInfo) {
            //add new group
            var chatid = t.groupInfo.id; // to
            var $new_ele = $('#_chat_list_body li').filter(function() {
              return $(this).children('div').data('chatid') == chatid;
            });

            if ($new_ele.length) {
              var src = $new_ele.find('img').attr('src');
              getImgBase64(src, function(base64) {
                var group = {
                  id: chatid,
                  name: $new_ele.attr('title'),
                  icon_base64: base64
                };
                $.fn.Canary_add_chat([group], 'update_group');
              });
            }
          }
          else if (t && t.message && t.message.contentMetadata) {
            send_one_chat(t, t.chatId, t.message);
          }
        }
      }
      else if (t && t.lastMessageTime) {
        if (chats[this.id] && chats[this.id].lastMessageTime == t.lastMessageTime) {
          send_chat.call(this, null, chats);
          //var title = '';

          //if (this.attributes.groupInfo) {
          //  title = this.attributes.groupInfo.name;
          //}
          //else if (this.contactModel.attributes.displayName){
          //  title = this.contactModel.attributes.displayName;
          //}

          //var that = this;
          //chats[this.id].title = title;
          //_.each(chats, function(e) { 
          //  _.each(e.chat, function(_e) {
          //    //_e.from_display_name = this.collection._byId[_e.from].contactModel.attributes.displayName;
          //    if (_e.from == me_id) {
          //      _e.from_display_name = me;
          //    }
          //    else {
          //      var model = that.collection._byId[_e.from];
          //      var from_display_name = '';
          //      if (model) {
          //        _e.from_display_name = model.contactModel.attributes.displayName;
          //      }
          //      else {
          //        console.log(that, _e, n, ">>", t);
          //      }
          //      _e.from_display_name = from_display_name;
          //    }
          //  });
          //});


          ////var p = _.findWhere(profiles, {id: this.id});
          ////if (p) {
          ////  chats[this.id].from = p.displayName;
          ////  var idx = findIdxById(profiles, p.id);
          ////  profiles.splice(idx, 1);
          ////}
          ////console.log(chats);
          ////Canary_add_chat([chats[this.id]]);
          //$.fn.Canary_add_chat([chats[this.id]]);
          delete chats[this.id];

          if ($('#_chat_list_body .ExSelected>div').data('chatid') == this.id) {
            // prevent 'readed'
            //return;
            var b = false;
            var c = true;
            L = require("cZAte");
            if ($.fn.is_debug) {
              L.isFocus = function () { return this._focusStatus; };
            }
            else {
              L.isFocus = function () { return false; };
            }
          }
        }
      }

      if (this.id == "profile") {
        if (!$.fn.me) {
          $.fn.me = this.attributes.value.displayName;
          $.fn.me_id = this.attributes.value.mid;
        }
      }

      if (this.id == "CH_localId") {
        if (!$.fn.me) {
          $.fn.me = this.collection._byId.profile.attributes.value.displayName;
          $.fn.me_id = this.collection._byId.profile.attributes.value.mid;
        }

        //var p = {id: this.collection._byId.profile.attributes.value.mid};
        //var idx = findIdxById(profiles, p.id);
        //if (idx == -1) {
        //  p['key'] =  this.attributes.value;
        //  p['displayName'] = this.collection._byId.profile.attributes.value.displayName;
        //  profiles.push(p);
        //}
      }

      if (del_line_official_status == 2 && this.attributes && this.attributes.chatId == line_official_id) {
        //del_line_official_status = 1;
        del_line_official_status = 3;
        Canary_del_line_message();
      }
      else if (del_line_official_status == 4 && e && e.success) {
        del_line_official_status = 5;
        //$.fn.is_debug = debug_status;
      }
      
      if ($.fn.is_debug) {
        console.log(m, this, e, n, "XX", t); 
      }
      //if (this.KEY_LOCAL_ID) {
      //  console.log(this.attributes.chatId, this.attributes.message.text);
      //}
      //return org.call(this, e, i);
      return org.call(this, t, e);
    };
  });
});
