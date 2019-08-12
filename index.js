$( document ).ready(function($) {
  var first_qrcode = true;
  var first_list = true;
  var kickoff_add_friend = false;
  var old_qrcode_src = null;
  var host = "http://127.0.0.1:8080";
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
  var login_form_timeid = null;
  var first_login_time = -1;
  var id_img_base64_mapping = {}; // id_img_base64_mapping[line_id] = base64 value
  var id_img_base64_mapping_synced = {}; // id_img_base64_mapping_synced[line_id] = base64 value
  var id_display_name_mapping = {}; // id_display_name_mapping[line_id] = display name
  var url_id_mapping = {}; // url_id_mapping[https:/xxx] = line_id
  var later_send_for_img_load_ids = [];
  var later_send_for_img_load_data = [];
  var later_send_for_content_img = [];
  var sync_history_img_arr = [];
  var sync_history_img_cnt = 0;
  var is_logouting = false;
  $.fn.is_debug_for_log = false;
  $.fn.is_debug = false;
  $.fn.is_force_reload_once_logout = true;
  $.fn.load_waiting_period = 6000;
  $.fn.first_login_waiting_period = 60 * 1000;
  //$.fn.is_debug = true;
  var del_line_official_status = 0; // 0 stop, 1 start sim chat with line, 2 end send, 3 del, 4 end del, 5 start add firend, 6 end add, 7 end copy user image and name, 8 end
  var del_line_official_status_itv = {
    "del": -1,
    "start_add_firend": -1,
    "end_copy_user_image_and_name": -1
  };
  var debug_status = null;
  $.fn.me = null;
  $.fn.me_id = "";
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
    login_form_timeid = setTimeout(login_form, 3000);
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
      $logout.find('button').trigger('click');
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

  var ask_status = function() {
    socket.emit( 'resp', {
      action: 'ask_status',
      rid: rid,
      p: {
        is_ongoing: del_line_official_status > 0,
      }
    });
  };

  var emit_sync_status = function(status, info) {
    if (status == -2) {
      is_logouting = true;
    }
    else if (status === 0 && is_logouting) {
      is_logouting = false;
    }

    if (is_logouting && status != -2) {
      console.warn("current logout, status ", status, ", 81");
      return;
    }

    var r = {
      action: 'sync_status',
      rid: rid,
      me_id: $.fn.me_id,
      p: {
        status: status,
      }
    };

    if (info) {
      r.p['info'] = info;
    }

    socket.emit( 'resp', r );
  };

  $.fn.emit_sync_status = emit_sync_status;

  var reset_status = function() {
    first_qrcode = true;
    first_list = true;
    kickoff_add_friend = false;
    $.fn.sync_old.syncing = false;
    $.fn.sync_old.sync_idx = 0;
    $.fn.sync_old.sync_cnt = 0;
    sync_history_img_arr = [];
    sync_history_img_cnt = 0;
		first_login_time = -1;
    $.fn.me_id = "";
    //$.fn.is_debug = null;

    clearTimeout(del_line_official_status_itv.del);
    clearTimeout(del_line_official_status_itv.start_add_firend);
    del_line_official_status_itv.start_add_firend = -1;
    clearTimeout(del_line_official_status_itv.end_copy_user_image_and_name);

    console.log("someone call reset");
    del_line_official_status = 0;
    emit_sync_status(del_line_official_status);
  };

  var reset_login_monitor = function() {
    if (monitor_chat_list_timeid) {
      clearTimeout(monitor_chat_list_timeid);
    }

    if (login_form_timeid) {
      clearTimeout(login_form_timeid);
    }

    login_form_timeout();
    monitor_chat_list_timeid = setTimeout(monitor_chat_list, 300);
  };

  var do_logout = function(retry_cnt) {
    retry_cnt = retry_cnt || 0;
    console.log("call by someone, retry ", retry_cnt);
    if (retry_cnt == 0) {
      var $logout = $('dialog').filter(function() { return $(this).attr('open') });
      $logout.find('button').trigger('click');
      del_line_official_status_itv.del = setTimeout(do_logout.bind(this, ++retry_cnt), 5000);
    }
    else {
      if (!$('#login_content').hasClass('MdNonDisp')) {
        console.log("something wrong, go login page");
        reset_status();
        //emit_heartbeat();
        reset_login_monitor();
      }
    }
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

	var first_login_success_init = function() {
		debug_status = $.fn.is_debug;
		del_line_official_status = 1;
		console.log('now is ', del_line_official_status);
		emit_sync_status(del_line_official_status);
		emit_heartbeat(1);

		$.fn.is_debug = true;
		Canary_sim_chat();

		first_list = false;
	};

  var monitor_chat_list = function() {
    monitor_chat_list_timeid = null;
    if ($('#_chat_list_body').length) {
      if (first_list && !first_qrcode) {
        //$('#_chat_list_body').bind("DOMSubtreeModified", function(event) {
        //  if (event.target.innerText && $(event.target).is('li')) {
        //    a = $('#_chat_list_body li');
        //    sync(a, c);
        //  }
        //  //localStorage.setItem("chat", JSON.stringify(c).replace(/\\n/g, ''));
        //});
        if (is_logouting) {
          console.warn("current force logout, 81");
          return;
        }

				if (!del_line_official_status) {
					first_login_success_init();
				}
        //debug_status = $.fn.is_debug;
        //del_line_official_status = 1;
        //console.log('now is ', del_line_official_status);
        //emit_sync_status(del_line_official_status);
        //emit_heartbeat(1);

        //$.fn.is_debug = true;
        //Canary_sim_chat();

        //first_list = false;
      }
      else {
        //var _myArray = JSON.stringify(localStorage , null, 4).replace(/\\n/g, '').replace('"[', '[').replace(']"', ']');
        //if (_myArray != last && localStorage.chat)
        //if (c.length) {

        //  Canary_add_chat();

        //  if (0) {
        //  var chat_serail =  JSON.stringify(c).replace(/\\n/g, '');
        //    var _myArray = '{"chat":'+chat_serail+'}';
        //    var vLink = document.createElement('a'),
        //      vBlob = new Blob([_myArray], {type: "octet/stream"}),
        //      vName = 'log_' + rid +'_' + Date.now() + '.json',
        //      vUrl = window.URL.createObjectURL(vBlob);
        //    vLink.setAttribute('href', vUrl);
        //    vLink.setAttribute('download', vName );
        //    vLink.click();
        //    localStorage.clear();
        //  }
        //  c = [];
        //  //last = _myArray;
        //}
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

		var current = + new Date();
		var diff = current - first_login_time;
		if (!del_line_official_status && first_login_time != -1 && diff > $.fn.first_login_waiting_period) {
			console.log('kick off long wait, diff is ' + diff);
			first_login_success_init();
		}

		if (del_line_official_status == 5 && del_line_official_status_itv.start_add_firend == -1) {
			console.log('force kick off add friend');
			//socket.disconnect();
			emit_heartbeat(1);
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

  //var monitor_qrcode = function(wait_status) {
  //  wait_status = wait_status || 0;
  //  var $qrcode = $('#login_qrcode_area img');
  //  switch (wait_status) {
  //    case 0:
  //      if ($qrcode.length) {
  //      }
  //      else {
  //        setTimeout(monitor_qrcode.bind(this), 1000);
  //        return;
  //      }
  //    case 1:
  //      $('#login_qrcode_area img').one("DOMSubtreeModified", function(event) {
  //        console.log(event);
  //      });
  //  }
  //};
  //monitor_qrcode();

  var login_form = function () {
    var $login_qr_btn = $('#login_qr_btn');
    var is_chat = $('#_chat_list_body').length != 0;
    if (!is_chat) {
      var src = get_login_qrcode_src();
      var need_sync_qrcode = src && src != old_qrcode_src;
      old_qrcode_src = src;

      if ((first_qrcode || is_user_pw_login_page() || need_sync_qrcode)) {
        if (is_user_pw_login_page()) {
          $('#layer_contents').find('button').trigger('click');
          //emit_heartbeat();
          first_qrcode = true;
          emit_sync_status(del_line_official_status);
        }
        else {
          if (!src) {
            // login page with only account / pw
            $login_qr_btn.trigger('click');
            //emit_heartbeat();
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
            is_logouting = false;
            emit_heartbeat();
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
  //var _Canary_add_friend = function() {
  //  if (del_line_official_status > 5) {
  //    //re-entry, 81
  //    return;
  //  }

  //  var $add_icon = $('#recommend_search_result_view #recommend_add_contact');
  //  var is_find = false;
  //  if ($add_icon.length == 0 && _Canary_add_friend_retry < _Canary_add_friend_retry_max) {
  //    _Canary_add_friend_retry++;
  //    setTimeout(_Canary_add_friend, 1000);
  //  }
  //  else {
  //    _Canary_add_friend_retry = 0;
  //    $add_icon.click();
  //    is_find = true;
  //  }

  //  if (is_find || _Canary_add_friend_retry >= _Canary_add_friend_retry_max) {
  //    del_line_official_status = 6;

  //    var $chats_list = $('#leftSide li').filter(function(){ return $(this).data('type') == 'chats_list' });
  //    $chats_list.trigger('click');

  //    Canary_get_user_info();
  //  }
  //};

  var Canary_add_friend = function(name, wait_status) {
		del_line_official_status_itv.start_add_firend = 0;
    if (del_line_official_status > 5) {
			console.log("re-entry, 81");
      return;
		}

    if (del_line_official_status != 5) {
      //ask_status();
      kickoff_add_friend = true;
      del_line_official_status_itv.start_add_firend = setTimeout(Canary_add_friend.bind(this, name, wait_status), 1000);
      return;
    }
    kickoff_add_friend = true;

    wait_status = _.isUndefined(wait_status) ? 0 : wait_status;

    switch (wait_status) {
      case 0:
        var $addfriends = $('#leftSide li').filter(function(){ return $(this).data('type') == 'addfriends' });
        $addfriends.trigger('click');
      case 1:
        if (del_line_official_status < 6 && ($('#recommend_search_input').height() == 0 || $('#recommend_search_input').width() == 0)) {
          console.log('wait search input display, retry');
          //ask_status();
          del_line_official_status_itv.start_add_firend = setTimeout(Canary_add_friend.bind(this, name, 1), 1000);
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
            //ask_status();
            del_line_official_status_itv.start_add_firend = setTimeout(Canary_add_friend.bind(this, name, 2), 1000);
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
            //ask_status();
            del_line_official_status_itv.start_add_firend = setTimeout(Canary_add_friend.bind(this, name, 3), 1000);
            return;
        }

        del_line_official_status = 6;
        console.log('now is ', del_line_official_status);
        emit_sync_status(del_line_official_status);
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
        icon_base64: base64,
        me_id: $.fn.me_id
      };

      id_img_base64_mapping[group.me_id] = base64;

      $.fn.Canary_add_chat(group, 'update_user');
      $('#label_setting button').trigger('click');


      var $li = $('#_chat_list_body li');
      //$.fn.sync_old.sync_cnt = $li.length;
      //$.fn.sync_old.$el = $li;

      var li_cnt = $li.length;
      update_chat_list_body($li, function($li, group, batch_sync) {
        li_cnt--;
        if (!li_cnt) {
          $.fn.Canary_add_chat(batch_sync, 'update_group');
        }
      });

      var $chats_list = $('#leftSide li').filter(function(){ return $(this).data('type') == 'chats_list' });
      $chats_list.trigger('click');

      del_line_official_status = 7;
      console.log('now is ', del_line_official_status);
      emit_sync_status(del_line_official_status);

      $.fn.is_debug = false;
      //$.fn.is_debug = debug_status;
    });
  }

  $.fn.Canary_get_user_info = Canary_get_user_info;

  var Canary_sim_chat = function(id, msg, wait_status, retry_cnt) {
    id = id || line_official_id;
    msg = msg || 'xxx';
    wait_status = wait_status || 0;
    retry_cnt = retry_cnt || 0;
    var $f_list = $('#leftSide li').filter(function(){ return $(this).data('type') == 'friends_list' });
    switch (wait_status) {
      case 0:
        $f_list.trigger('click');

        var $li = $('#contact_wrap_friends li');

        if (!$li.length) {
          console.log("no friend, re-click again");
          setTimeout(Canary_sim_chat.bind(this, id, msg, wait_status, retry_cnt), 1000);
          return;
        }

        //var old_sync_cnt = $.fn.sync_old.sync_cnt;
        //$.fn.sync_old.sync_cnt = $li.length;
        var cnt = $li.length;

        $li.each(function(){
          var $this = $(this);
          var id = $this.data('mid');
          var title = $this.attr('title');
          id_display_name_mapping[id] = title;
        });

        var need_async_imgs = _.partition($li, function(item) {
          return $(item).find('img').attr('src').search('img') != -1;
        });

        var all_load_cb = function($li) {
          cnt--;
          if (cnt <= 0) {
            wait_status = 2;
            //$.fn.sync_old.sync_cnt = old_sync_cnt;
            if (del_line_official_status == 1) {
              //ask_status();
              setTimeout(Canary_sim_chat.bind(this, id, msg, wait_status, retry_cnt), 1000);
            }
          }
        };

        var lazy_load_imgs = need_async_imgs[0];
        var exist_cache_imgs = need_async_imgs[1];


        if (lazy_load_imgs.length) {
          lazy_get_img(lazy_load_imgs, $li, all_load_cb);
        }

        $(exist_cache_imgs).each(function(i) {
          var $this = $(this); 
          var src = $this.find('img').attr('src');
          getImgBase64(src, function(base64) {
            var chatid = $this.data('mid');
            var group = {
              id: chatid,
              name: $this.attr('title'),
              icon_base64: base64,
              me_id: $.fn.me_id
            };

            id_display_name_mapping[group.id] = group.name;
            id_img_base64_mapping[group.id] = base64;

            //$.fn.Canary_add_chat([group], 'update_group');

            //$.fn.sync_old.sync_cnt--;
            check_load_history($li, all_load_cb);
          });
        });
        wait_status = 1;
      case 1:
        //if (del_line_official_status == 1) {
        //  console.log("wait sync done, 81");
        //  setTimeout(Canary_sim_chat.bind(this, id, msg, wait_status, retry_cnt), 1000);
        //}
        break;
      case 2:
        var $line_official = $('#contact_wrap_friends li').filter(function(){return $(this).data('mid') == id});
        if (!$line_official.length) {
					$line_official = $('#contact_wrap_search_friends li').filter(function(){return $(this).data('mid') == id});
				}

        if (!$line_official.length) {
          var search_input = document.getElementById('search_input');
          var search_friend = 'LINE';
          var is_del_search_btn = !($('#search_input').parent().find('button').hasClass('MdNonDisp')) && search_input.value == search_friend;

          if (is_del_search_btn) {
            console.log("find line is hidden or blocked");
            $('._globalSetting').click();
            $('#context_menu #settings').click();
            $('#settings_menu_list li').last().click();
            $('#settings_friends_block_list li, #settings_friends_hidden_list li');
            $line_official = $('#settings_friends_block_list li, #settings_friends_hidden_list li').filter(function(){return $(this).find('button').data('mid') == id;})

            if (!$line_official.length) {
							console.log("maybe line account deleted, goto add friend");
							del_line_official_status = 5;
							return;
						}

            $line_official.find('button').click();
            $('#context_menu #unhide').click();
            $('#label_setting button').trigger('click');
            setTimeout(Canary_sim_chat.bind(this, id, msg, wait_status, ++retry_cnt), 1000);
            return;
          }

          search_input.value = search_friend;

          var e = $.Event('keyup');
          e.keyCode = 13;
          $('#search_input').focus().trigger(e);
          setTimeout(Canary_sim_chat.bind(this, id, msg, wait_status, ++retry_cnt), 1000);
          console.log("search line ", retry_cnt);
          return;
        }

        $line_official.trigger('click');

        var e = $.Event('keydown');
        e.shiftKey = 0;
        //e.keyCode = 68;
        //$('#_chat_room_input').html('test').focus().trigger(e);
        var room_input = document.getElementById('_chat_room_input');
        if (room_input) {
          room_input.innerText = msg;
        }
        else {
          //ask_status();
          setTimeout(Canary_sim_chat.bind(this, id, msg, wait_status, retry_cnt), 1000);
          return;
        }

        //$('#_chat_room_input').focus().trigger(e);
        e.keyCode = 13;
        //$('#_chat_room_input').focus().html('test').trigger(e);
        $('#_chat_room_input').focus().trigger(e);

      case 3:

        if (document.getElementById('_chat_room_input').innerText) {
          console.log("not send yet, retry");
          //ask_status();
          setTimeout(Canary_sim_chat.bind(this, id, msg, wait_status, retry_cnt), 1000);
          return;
        }

        if (del_line_official_status == 1) {
          del_line_official_status = 2;
          console.log('now is ', del_line_official_status);
          emit_sync_status(del_line_official_status);

          //del_line_official_status = 3;
          //console.log('now is ', del_line_official_status);
          //emit_sync_status(del_line_official_status);
          //clearTimeout(del_line_official_status_itv.del);
          //del_line_official_status_itv.del = setTimeout(Canary_del_line_message.bind(this), 1000);
          setTimeout(function() {
            if (del_line_official_status < 3) {
              console.log("sim fail, re-sim");
              clearTimeout(del_line_official_status_itv.del);
              wait_status = 2;
              Canary_sim_chat(id, msg, wait_status, retry_cnt);
            }
          }, 10000);
        }
    }
  };
  $.fn.Canary_sim_chat = Canary_sim_chat;

  var isScrolledIntoView = function (elem) {
    var docViewTop = $(window).scrollTop();
    var docViewBottom = docViewTop + $(window).height();

    var elemTop = $(elem).offset().top;
    var elemBottom = elemTop + $(elem).height();

    return ((elemBottom <= docViewBottom) && (elemTop >= docViewTop));
  }

  var get_id_in_chatlist = function(id, $container) {
    id = id || line_official_id;
    $container = $container || $('.chatList');
    return $('.chatList').filter(function(){ return $(this).data('chatid') == id });
  }

  var Canary_del_line_message = function(id, wait_status, is_reentry, retry_cnt) {
    //var debug_status = $.fn.is_debug;
    //return;
    $.fn.is_debug = true;
    id = id || line_official_id;
    wait_status = _.isUndefined(wait_status) ? 0 : wait_status;
    is_reentry = is_reentry || 0; // 0 init 1 re-entry 2 direct into step 5
    retry_cnt = retry_cnt || 0;

    var check_kickoff_add_friend = function() {
      if (!kickoff_add_friend && del_line_official_status == 5) {
        emit_heartbeat(1);
        del_line_official_status_itv.del = setTimeout(Canary_del_line_message.bind(this, id, 4, is_reentry), 1000);
      }
    };

    var $chats_list = $('#leftSide li').filter(function(){ return $(this).data('type') == 'chats_list' });

    switch (wait_status) {
      case 0:
        $chats_list.trigger('click');
      case 1:
        var $line_official = get_id_in_chatlist(id);
        if ($line_official.length > 0) {
        }
        else if ($chats_list.find('button').first().hasClass('ExSelected')){
          console.log("deleted success, next");
          del_line_official_status = 5;
          console.log('now is ', del_line_official_status);
          emit_sync_status(del_line_official_status);
          check_kickoff_add_friend();
          return;
        }
        else {
          console.log("no id, retry", id);
          //ask_status();
          del_line_official_status_itv.del = setTimeout(Canary_del_line_message.bind(this, id, 0, is_reentry), 1000);
          return;
        }

        if (!is_reentry) {
          var src = $line_official.find('img').attr('src');
          var name = $line_official.closest('li').attr('title');
          getImgBase64(src, function(base64) {
            var group = {
              id: id,
              name: name,
              icon_base64: base64,
              me_id: $.fn.me_id
            };

            id_display_name_mapping[group.id] = group.name;
            id_img_base64_mapping[group.id] = base64;

            $.fn.Canary_add_chat([group], 'update_group');
          });
        }

      case 2:
        if ($('#context_menu').height() == 0 || $('#context_menu').width() == 0 || !isScrolledIntoView($('#context_menu'))) {
          var $line_official = get_id_in_chatlist(id);
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
          //ask_status();
          del_line_official_status_itv.del = setTimeout(Canary_del_line_message.bind(this, id, 0, is_reentry), 1000);
          return;
        }
        $('#context_menu #delete_chat').click();
      case 3:
        var $del_btn = $('#layer_contents ._layer_left');
        if ($del_btn.length > 0) {
          $('#layer_contents ._layer_left').click();
          // it could syn fail, delete twice
          var $line_official = get_id_in_chatlist(id);
          var $chats_list = $('#leftSide li').filter(function(){ return $(this).data('type') == 'chats_list' });
          var deleted = !$line_official.length && $chats_list.find('button').hasClass('ExSelected');
          if (deleted) {
            if (del_line_official_status >= 7) {
              return;
            }
            del_line_official_status = 4;
            console.log('now is ', del_line_official_status);
            emit_sync_status(del_line_official_status);
            if (is_reentry >= 2) {
              console.log('kick off add friend');
              del_line_official_status = 5;
              console.log('now is ', del_line_official_status);
              emit_sync_status(del_line_official_status);
              check_kickoff_add_friend();
            }
            else {
              is_reentry = 1;
              //ask_status();
              del_line_official_status_itv.del = setTimeout(Canary_del_line_message.bind(this, id, 0, is_reentry), 1000);
            }
          }
          else {
            is_reentry = 1;
            //ask_status();
            del_line_official_status_itv.del = setTimeout(Canary_del_line_message.bind(this, id, 0, is_reentry), 1000);
          }
        }
        else {
          console.log("no del popup, retry", id);
          //ask_status();
          del_line_official_status_itv.del = setTimeout(Canary_del_line_message.bind(this, id, 2, is_reentry), 1000);
          return;
        }

      case 4:
        check_kickoff_add_friend();
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

  var Canary_reload = function() {
    socket.emit( 'resp', {
      action: 'reload',
      rid: rid
    }, function(confirmation) {
      console.warn("ready re-relaunch it", confirmation);
    });

    setTimeout(function() {
      chrome.runtime.reload();
    }, 2000);
  }
  $.fn.Canary_reload = Canary_reload;

  var Canary_logout = function(p, retry) {
    if ($.fn.is_force_reload_once_logout) {
      Canary_reload();
      return;
    }

    retry = retry || 0;

    //if (!is_logouting && first_qrcode) {
    //  console.warn("logout done, 81");
    //  reset_login_monitor();
    //  return;
    //}

    emit_sync_status(-2);
    $.fn.is_debug = false;
    is_logouting = true;
    reset_status(); 

    console.warn("logout start");

    if (first_list && !first_qrcode && !$('#_chat_list_body').length) {
      // first login, and sync with line server, force reload
      Canary_reload();

      //window.onbeforeunload = function() {
      //  return null;
      //};

      //location.reload(true);
      ////retry, force reload it
      ////setTimeout(Canary_logout.bind(this, ++retry), 1000);
      //return;
    }

    var $context_menu = $('#context_menu');
    var context_mene_top = parseInt($context_menu.css('top').replace('px', ''), 10)
    var context_mene_left = parseInt($context_menu.css('left').replace('px', ''), 10)
    var is_context_mene_show = context_mene_top > 0 && context_mene_left > 0;

    if ($('._globalSetting').length && !is_context_mene_show) {
      $('._globalSetting').click();
    }

    $('#context_menu #setting_logout').click();

    //_Canary_logout();

    reset_login_monitor();

    if ($('#_chat_list_body').length) {
      console.log("logout fail, retry");
      setTimeout(Canary_logout.bind(this, p, ++retry), 3000);
      if ($('._globalSetting').length && !is_context_mene_show) {
        $('._globalSetting').click();
      }
      return;
    }
  };
  $.fn.Canary_logout = Canary_logout;

  var Canary_sync_group = function() {
    var $li = $('#_chat_list_body li');
    $.fn.sync_old.sync_cnt = 0;
    $.fn.sync_old.$el = $li;
    check_load_history($li);
  };
  $.fn.Canary_sync_group = Canary_sync_group;

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

      if (is_logouting) {
        console.log("current force logout, 81");
        return;
      }

      chats = chats || c;
      action = action || 'add_chats';

      if (action == 'add_chats') {
        var l = chats.length;
        while(l--) {
          if (!chats[l].chat) {
            console.log("not chat, next", chats);
            continue;
          }
          var j = chats[l].chat.length;
          while(j--) {
            if (later_send_for_img_load_ids.indexOf(chats[l].chat[j].from) != -1) {
              // all of group in chat pending send until all image request back
              var _chats = chats.splice(l, 1);
              later_send_for_img_load_data.push(_chats[0]);
              break;
            }
          }
        }

        if (!chats.length) {
          console.log("later_send_for_img_load_data need reshedule, 81");
          return;
        }
      }

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
      else if (action == 'update_friend_icon') {
        d['friends'] = chats[0];
        d.len = _.keys(d['friends']).length;
        d['me_id'] = $.fn.me_id;
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

	var socket_init = function(socket) {
		socket.on('connect', function(s) {
			//s.join(rid);
			socket.emit('join', {room: rid});

			ask_status();
			//socket.emit('subscribe', {'room':'test'});

			//socket.emit( 'my event', {
			//  data: 'User Connected'
			//});
		});

		socket.on('disconnect', function(s) {
			console.log("disconnct, re-connect it");
			socket = io.connect(host + '/canary');
			socket_init(socket);
			if (del_line_official_status) {
				emit_heartbeat(1);
				emit_sync_status(del_line_official_status);
			}
		});

		socket.on('message', function(msg){
			var action = msg.action;
			var p = msg.p;
			console.log("got socketio msg ", msg);
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

				case 'status':
					var info = null;
					if ($.fn.sync_old.syncing) {
						info = ($.fn.sync_old.sync_idx+1) + " / " + $.fn.sync_old.sync_cnt;
					}
					emit_sync_status(del_line_official_status, info);
					break;

				case 'refresh':
					//window.onbeforeunload = function() {
					//  return null;
					//};
					//location.reload(true);
					Canary_reload();
					break;

				case 'sync_group':
					del_line_official_status = 7;
					console.log('now is ', del_line_official_status);
					Canary_sync_group();
					break;

				case 'resp_status':
					if (p == -2) {
						console.warn("server in logout, start it");
						//Canary_logout(p);
					}
			}
		});
	};

	socket_init(socket);

  //socket.on('connect', function(s) {
  //  //s.join(rid);
  //  socket.emit('join', {room: rid});

  //  ask_status();
  //  //socket.emit('subscribe', {'room':'test'});

  //  //socket.emit( 'my event', {
  //  //  data: 'User Connected'
  //  //});
  //});

  //socket.on('disconnect', function(s) {
  //  console.log("disconnct, re-connect it");
  //  socket = io.connect(host + '/canary');
  //});

  //socket.on('message', function(msg){
  //  var action = msg.action;
  //  var p = msg.p;
  //  console.log("got socketio msg ", msg);
  //  switch (action) {
  //    case 'add_friend':
  //      Canary_add_friend(p);
  //      break;

  //    case 'del_line_message':
  //      Canary_del_line_message(p);
  //      break;

  //    case 'logout':
  //      Canary_logout(p);
  //      break;

  //    case 'heartbeat':
  //      if (!first_list) {
  //        emit_heartbeat(1);
  //      }
  //      break;

  //    case 'status':
  //      var info = null;
  //      if ($.fn.sync_old.syncing) {
  //        info = ($.fn.sync_old.sync_idx+1) + " / " + $.fn.sync_old.sync_cnt;
  //      }
  //      emit_sync_status(del_line_official_status, info);
  //      break;

  //    case 'refresh':
  //      //window.onbeforeunload = function() {
  //      //  return null;
  //      //};
  //      //location.reload(true);
  //      Canary_reload();
  //      break;

  //    case 'sync_group':
  //      del_line_official_status = 7;
  //      console.log('now is ', del_line_official_status);
  //      Canary_sync_group();
  //      break;

  //    case 'resp_status':
  //      if (p == -2) {
  //        console.warn("server in logout, start it");
  //        //Canary_logout(p);
  //      }
  //  }
  //});

  var send_chat = function(title, chats, is_pending) {
    if (!title) {
      if (this.attributes && this.attributes.groupInfo) {
        title = this.attributes.groupInfo.name;
      }
      else if (this.contactModel && this.contactModel.attributes.displayName){
        title = this.contactModel.attributes.displayName;
      }
      else {
        title = id_display_name_mapping[this.id];
        if (!title) {
          title = 'xx';
          var id = chats[this.id].chat[0].from;
          title = id_display_name_mapping[id];
          if (!title) {
            title = " ";
          }
          chats[this.id].icon_base64 = id_img_base64_mapping[id];
        }
      }
    }

    var that = this;
    var is_no_display_name = false;

    chats[this.id].title = title;
    _.each(chats, function(e) { 
      _.each(e.chat, function(_e) {
        //_e.from_display_name = this.collection._byId[_e.from].contactModel.attributes.displayName;
        if (_e.from == $.fn.me_id) {
          _e.from_display_name = $.fn.me;
        }
        else {
          if (!_e.from_display_name) {
            _e.from_display_name = "";

            if (id_display_name_mapping[_e.from]) {
              _e.from_display_name = id_display_name_mapping[_e.from];
            }

            if (that.collection) {
              var model = that.collection._byId[_e.from];
              if (model && model.contactModel && !_e.from_display_name) {
                _e.from_display_name = model.contactModel.attributes.displayName;
              }
              else {
                if ($.fn.is_debug_for_log) {
                  console.log(that, _e, ">>");
                }
              }
            }

            if (!_e.from_display_name && del_line_official_status >= 7) {
              is_no_display_name = true;
            }
          }
        }

        if (id_img_base64_mapping[_e.from]) {
          _e['icon_base64'] = id_img_base64_mapping[_e.from];
        }
      });
    });

    if (!is_pending && !is_no_display_name) {
      $.fn.Canary_add_chat([chats[this.id]]);
    }

    if (is_no_display_name) {
      var $to = get_id_in_chatlist(this.id);
      $to.trigger('click');

      if ($.fn.is_debug_for_log) {
        console.log("click group", $to.attr('title'), this.id, $to, chats);
      }
    }

    return chats[this.id];
  };

  var _getImgBase64 = function(response, cb) {
    // Create a binary string from the returned data, then encode it as a data URL.
    var array2base64 = function(i, uInt8Array) {
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
    }

    var uInt8Array = new Uint8Array(response);
    var i = uInt8Array.length;

    if (!i) {
      var fileReader = new FileReader();
      fileReader.onload = function(event) {
        var uInt8Array  = new Uint8Array(event.target.result);
        var i = uInt8Array.length;
        array2base64(i, uInt8Array);
        //console.log(uint8ArrayNew, "XX")
      };
      fileReader.readAsArrayBuffer(response);
    }
    else {
      array2base64(i, uInt8Array);
    }
    //var binaryString = new Array(i);
    //while (i--)
    //{
    //  binaryString[i] = String.fromCharCode(uInt8Array[i]);
    //}
    //var data = binaryString.join('');

    //var base64 = window.btoa(data);

    //if (cb && {}.toString.call(cb) === '[object Function]') {
    //  cb(base64);
    //}
  };
  $.fn._getImgBase64 = _getImgBase64;

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
        _getImgBase64(this.response, cb);
        //// Create a binary string from the returned data, then encode it as a data URL.
        //var uInt8Array = new Uint8Array(this.response);
        //var i = uInt8Array.length;
        //var binaryString = new Array(i);
        //while (i--)
        //{
        //  binaryString[i] = String.fromCharCode(uInt8Array[i]);
        //}
        //var data = binaryString.join('');

        //var base64 = window.btoa(data);

        //if (cb && {}.toString.call(cb) === '[object Function]') {
        //  cb(base64);
        //}
        //console.log(base64);

        //document.getElementById("myImage").src="data:image/png;base64," + base64;
      }
    };
    // Send XHR
    xhr.send();
  };
  $.fn.getImgBase64 = getImgBase64;

  var get_view = function(t, t_data) {
    if (t_data && t_data._events && t_data._events.add && t_data._events.add.length && t_data._events.add[0].ctx) {
      var ctx = t_data._events.add[0].ctx;
      var child_data = ctx.buildChildView(t, ctx.uvmAwfyeyL(t)).render();
      if ($.fn.is_debug_for_log) {
        console.log(child_data, 'get view');
      }
      return child_data;
    }
    return null;
  }

  var get_sticker_msg = function(message) {
    if (message && !message.text && message.contentMetadata && message.contentMetadata.STKVER) {
      if ($.fn.is_debug_for_log) {
        console.log(message, this, "sticker sync mustacheExtend");
      }
      //type = 2; // sticker
      var m = message.contentMetadata;
      var sticker_type = "stickers";
      if (m.STKOPT == 'A') {
        sticker_type = "animation";
      }
      return "https://stickershop.line-scdn.net/products/0/0/"+ m.STKVER + "/" + m.STKPKGID + "/PC/" +sticker_type+ "/" + m.STKID + ".png";
    }
    return null;
  };

  var send_one_chat = function(t, chatId, message, t_data, is_pending) {
    var chats = {};
    var type = "1" // chat

    chats[chatId] = {
      lastMessageTime: '',
      id: chatId,
      me_id: $.fn.me_id,
      title: '',
      chat: []
    };

    var sticker_msg = get_sticker_msg(message);
    if (sticker_msg) {
      message.text = sticker_msg;
      type = "2" // sticker
    }
    else if (message.contentMetadata && message.contentMetadata.OBS_POP == "b") {
      message.text = t_data;
      type = "3" // image
    }

    //if (message && !message.text && message.contentMetadata && message.contentMetadata.STKVER) {
    //  console.log(t, this, "sticker sync mustacheExtend");
    //  type = 2; // sticker
    //  var m = message.contentMetadata;
    //  var sticker_type = "stickers";
    //  if (m.STKOPT) {
    //    sticker_type = "animation";
    //  }
    //  message.text = "https://stickershop.line-scdn.net/products/0/0/"+ m.STKVER + "/" + m.STKPKGID + "/PC/" +sticker_type+ "/" + m.STKID + ".png";
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

    var chat = {
      title:'',
      chat: message.text,
      time: message.createdTime,
      from: message.from,
      cid: chatId,
      type: type,
      icon_base64: ""
    }; 

    //console.log(get_view(t, t_data), 'get view');
    var view_ele = get_view(t, t_data);
    // no chance to get image
    if (view_ele) {
      chat['from_display_name'] = view_ele.$el.find('div').filter(function(){ return $(this).attr('class').search('Ttl') != -1;}).html();
      if ($.fn.is_debug_for_log) {
        console.log(view_ele);
      }
    }

    if (id_img_base64_mapping[message.from]) {
      chat['icon_base64'] = id_img_base64_mapping[message.from];
    }

    //if (message.from == $.fn.me_id) {
    //  chat['me'] =  $.fn.me_id
    //}


    chats[chatId].chat.push(chat);
    chats[chatId].lastMessageTime = message.createdTime;
    t.id = chatId;

    return send_chat.call(t, null, chats, is_pending);
  };

  var sync_history_img = function(chat) {
    if (chat) {
      sync_history_img_arr.push(chat);
    }
    else {
      if (sync_history_img_arr.length) {
        sync_history_img_cnt -= sync_history_img_arr.length;
        $.fn.Canary_add_chat(_.map(sync_history_img_arr, _.clone));
        sync_history_img_arr = [];
      }
    }
  };

  require(["mustacheExtend"], function(e) {
    var a = Backbone.Collection.prototype.set;
    Backbone.Collection.prototype.set = function(t, e) {
      var pass = true;
      if (Array.isArray(t) && t[0]) {
        var need_lazy_get_img_hdr = {
          cur: -1,
          need_lazy_get_imgs: []
        };
        if (t[0].attributes && t[0].attributes.message) {
          // sync old chat
          //console.log(t, e, this, "group sync mustacheExtend");
          var chats = [];
          //var id_display_name_mapping = {};
          var get_history_img = function(_t) {
            var m = require("common/imageCache/MessageThumbnailCollection");
            m.tsLlgebyUH(_t, 101, function(b, e) {
              getImgBase64(b, function(base64) { 
                var end_chat = del_line_official_status == 8;
                var chat = send_one_chat(_t, _t.attributes.chatId, _t.attributes.message, base64, !end_chat);
                if (!end_chat) {
                  sync_history_img_cnt++;
                  sync_history_img(chat);
                }
              });
            });
          };

          for (var i = 0; i < t.length; i++) {
            var chatId = t[i].attributes.chatId; // to
            var message = t[i].attributes.message;
            var type = "1";
            var is_need_schedule = false;

            if (!message.from) {
              console.log(message, i, t[i], t, e, this, "no from data");
              continue;
            }

            if (!message.text) {
              var sticker_msg = get_sticker_msg(message);
              if (sticker_msg) {
                type = "2" // sticker
                message.text = sticker_msg;
              }
              else if (message.contentMetadata && message.contentMetadata.OBS_POP == "b") {
                //_onCollectionAdd->addChild --> _triggerEventOnParentLayout
                if (id_img_base64_mapping[message.from]) { //<! no hdr and send img
                  get_history_img(t[i]);
                  continue;
                }
                //later_send_for_content_img.push(t[i]);
              }
              else {
                console.log(message, i, t[i], t, e, this, "no sticer / img data");
                continue;
              }
            }

            var _chat = _.findWhere(chats, {id: chatId});

            if (!_chat) {
              _chat = {
                lastMessageTime: message.createdTime,
                id: chatId,
                title: '',
                me_id: $.fn.me_id,
                chat: []
              };
              chats.push(_chat);
            }

            if (message.createdTime > _chat.lastMessageTime) {
              _chat.lastMessageTime = message.createdTime;
            }

            //data-picture-path
            //this.$el.find(".mdCMN04Img img").data('picture-path')
            //0m005c58a6725108b04253e553362a854feec3cf5e99cd
            //https://obs.line-scdn.net/0m005c58a6725108b04253e553362a854feec3cf5e99cd/preview
            var chat = {
              title:'',
              chat: message.text,
              time: message.createdTime,
              from: message.from,
              type: type,
              cid: chatId,
              from_display_name: "",
              icon_base64: ""
            }; 

            if (message.from == $.fn.me_id) {
              chat['me'] =  $.fn.me_id
              chat['from_display_name'] = $.fn.me;
            }
            else {
              chat['from_display_name'] = id_display_name_mapping[message.from];
            }

            // get base64 image
            var view_ele = get_view(t[i], this);
            if (view_ele) {
              if (!chat['from_display_name']) {
                chat['from_display_name'] = view_ele.$el.find('div').filter(function(){ 
                  if (!$(this).attr('class')) {
                    console.log("no exist from_display_name layout");
                    return false;
                  }
                  return $(this).attr('class').search('Ttl') != -1;
                }).html();
                id_display_name_mapping[message.from] = chat['from_display_name'];
              }

              var src = view_ele.$el.find('div').filter(function(){ return $(this).attr('class').search('Img') != -1;}).find('img').attr('src');
              if (!src) {
                console.log("no src in load history", view_ele);
              }
              else {
                // find cache one
                chat['icon_base64'] = id_img_base64_mapping[message.from];
                if (!chat['icon_base64']) {
                  // otherwise, getimage

                  if (src.search('img') != -1) {
                    var model = view_ele.model.DnpcOiNSqb();
                    if (model) {
                      if (view_ele.model.DnpcOiNSqb().attributes.picturePath) {
                        src = "https://obs.line-scdn.net/" + view_ele.model.DnpcOiNSqb().attributes.picturePath + "/preview";
                      }
                      else {
                        //src = -1;
                        src = "/res/img/noimg/img_friend_profile_46x46_3.png";
                      }
                    }
                    else {
                      console.log("no image");
                      src = "/res/img/noimg/img_friend_profile_46x46_3.png";
                    }
                  }

                  chat['icon_base64'] = src;
                  var __chat = _.extend({}, _chat);

                  if (message.contentMetadata && message.contentMetadata.OBS_POP == "b") {
                    chat['type'] = _.extend({}, t[i]);
                  }

                  __chat.chat = [chat];
                  need_lazy_get_img_hdr.need_lazy_get_imgs.push(__chat);
                  is_need_schedule = true;
                }
              }
            }

            if (!is_need_schedule) {
              _chat.chat.push(chat);
            }
          }

          if (chats.length) {
            pass = false;
            //$.fn.Canary_add_chat(chats);
            $.fn.Canary_add_chat(_.map(chats, _.clone));
          }

          if (need_lazy_get_img_hdr.need_lazy_get_imgs.length) {
            var need_lazy_get_img_sync = function() {
              if (need_lazy_get_img_hdr.cur >= need_lazy_get_img_hdr.need_lazy_get_imgs.length) {
                var lazy_chats = _.extend({}, need_lazy_get_img_hdr.need_lazy_get_imgs[0]);
                lazy_chats.chat = [];
                need_lazy_get_img_hdr.need_lazy_get_imgs.forEach(function(__chat) {
                  if (__chat.chat[0]['icon_base64'] == -1 && id_img_base64_mapping[__chat.chat[0].from]) {
                    __chat.chat[0]['icon_base64'] = id_img_base64_mapping[__chat.chat[0].from];
                  }

                  if (_.isObject(__chat.chat[0]['type'])) {
                    get_history_img(__chat.chat[0]['type']);
                  }
                  else {
                    lazy_chats.chat.push(__chat.chat[0]);
                  }
                });
                $.fn.Canary_add_chat([lazy_chats]);
              }
            };

            need_lazy_get_img_hdr.cur = 0;
            need_lazy_get_img_hdr.need_lazy_get_imgs.forEach(function(__chat) {
              if (__chat.chat[0]['icon_base64'] == -1) {
                if (id_img_base64_mapping[__chat.chat[0].from]) {
                  __chat.chat[0]['icon_base64'] = id_img_base64_mapping[__chat.chat[0].from];
                }
                else {
                  console.log("no image, still update it", __chat);
                }
                need_lazy_get_img_hdr.cur++;
                need_lazy_get_img_sync();
              }
              else {
                getImgBase64(__chat.chat[0]['icon_base64'], function(base64) {
                  __chat.chat[0]['icon_base64'] = base64;

                  id_img_base64_mapping[__chat.chat[0].from] = base64;

                  need_lazy_get_img_hdr.cur++;
                  need_lazy_get_img_sync();
                });
              }
            });
          }

          if ($.fn.sync_old.syncing) {
            $.fn.sync_old.syncing_start = + new Date();
          }
        }
      }
      else if (t && t.attributes && t.attributes.groupInfo) {
        if ($.fn.is_debug_for_log) {
          console.log(t, e, this, "new group sync mustacheExtend");
        }
      }
      else if (t && t.attributes && t.attributes.chatId) {
        var b = true;
        var c = false;
        //FIXME: not prevent send
        if (b && $('#_chat_list_body .ExSelected>div').data('chatid') == t.attributes.chatId) {
          //console.log("===>",t.attributes.message.contentMetadata.STKPKGID);
          var that = this;
          if (line_official_id == t.attributes.chatId) {
            that = null;
          }
          if (t.attributes.message) {
            // first send, less information, skip to last
            //send_one_chat(t, t.attributes.chatId, t.attributes.message, that);
            if ($.fn.is_debug_for_log) {
              console.log("later send", t, that);
            }
          }
          else {
            if ($.fn.is_debug_for_log) {
              console.log(t, this, 'no message.text');
            }
          }
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

      if (t && t.key == "notificationEnable") {
        console.log("notificationEnable", t);
        emit_sync_status(-1);
        emit_heartbeat(1);
				first_login_time = + new Date();
      }

      if (pass || $.fn.is_debug) {
        if ($.fn.is_debug_for_log) {
          console.log(t, e, this, "mustacheExtend");
        }
        return a.call(this, t, e);
      }
    };
  });

  $.fn.sync_old.sync = function() {
    if (del_line_official_status < 7) {
      //ask_status();
      del_line_official_status_itv.end_copy_user_image_and_name = setTimeout(this.sync.bind(this), 3000);
      return;
    }

    //var $chats_list = $('#leftSide li').filter(function(){ return $(this).data('type') == 'chats_list' });
    //if (!$chats_list.find('button').hasClass('ExSelected')) {
    //  // for new friend
    //  console.log("new firend add");
    //  var $li = $('#contact_wrap_new_friends li');
    //  var new_friend_img = $li.find('img').attr('src');
    //  var id = $li.data('mid');
    //  getImgBase64(new_friend_img, function(base64) {
    //    id_img_base64_mapping[id] = base64;
    //  });

    //  $chats_list.trigger('click');
    //}

    var elapsed = this.syncing_end - this.syncing_start;
    var old_sync_idx = this.sync_idx;
    //this.sync_cnt = this.$el.length;
    $.fn.is_debug = false;

    if (this.syncing) {
      this.syncing_end = + new Date();
      $('#_chat_message_area').scrollTop(10);
      var $_prev_msg_btn = $('#_prev_msg_btn');
      $_prev_msg_btn.trigger('click');
      if (elapsed > $.fn.load_waiting_period && 
        (($_prev_msg_btn.length > 0 && $_prev_msg_btn.hasClass('MdNonDisp')) || $_prev_msg_btn.length == 0)) {
        this.sync_idx++;
        if (this.sync_idx >=this.sync_cnt) {
          $.fn.sync_old.syncing = false;
          del_line_official_status = 8;
          console.log('now is ', del_line_official_status);
          emit_sync_status(del_line_official_status, "update_friend_icon");

          console.log("sync user icon icon_base64");
          var prepare_sync = {};
          _.each(id_img_base64_mapping, function(v, k) { 
            if (id_img_base64_mapping_synced[k] != v) {
              prepare_sync[k] = v;
              id_img_base64_mapping_synced[k] = v;
            }
          });

          if (_.keys(prepare_sync).length) {
            $.fn.Canary_add_chat([prepare_sync], 'update_friend_icon');
          }

          sync_history_img(null, 1);
        }
      }
      del_line_official_status_itv.end_copy_user_image_and_name = setTimeout(this.sync.bind(this), 3000);
    }

    if (this.sync_idx == -1) {
      this.sync_idx = 0;
      this.$el = $('#_chat_list_body li');
      this.sync_cnt = this.$el.length;

      var L = require("cZAte");
      if ($.fn.is_debug) {
        L.isFocus = function () { return this._focusStatus; };
      }
      else {
        L.isFocus = function () { return false; };
      }
    }

    if (old_sync_idx != this.sync_idx && this.sync_idx <= this.sync_cnt) {
      ask_status();

      var $add_lis = [];
      var that = this;
      $('#_chat_list_body li').each(function() {
        var id = $(this).find('.chatList').data('chatid'); //console.log(id);
        if (!that.$el.filter(function(){ return $(this).find('.chatList').data('chatid') == id }).length) {
          $add_lis.push($(this)[0])
        }
      });

      if ($add_lis.length) {
        this.$el = $(this.$el.concat($add_lis));
        this.sync_cnt += $add_lis.length;

        var li_cnt = $add_lis.length;
        update_chat_list_body($($add_lis), function($li, group, batch_sync) {
          li_cnt--;
          if (!li_cnt) {
            $.fn.Canary_add_chat(batch_sync, 'update_group');
          }
        });

        console.log("add new chat list after sync");
      }

      var $chats_list = $('#leftSide li').filter(function(){ return $(this).data('type') == 'chats_list' });
      $chats_list.trigger('click');

      $('#_chat_list_scroll').scrollTop($('#_chat_list_scroll')[0].scrollHeight);



      var $current = $(this.$el[this.sync_idx]);

      var id = $current.find('.chatList').data('chatid');
      $current = get_id_in_chatlist(id).first().closest('li');

      if (get_id_in_chatlist(line_official_id).length) {
        console.log("delete line officail account again");
        del_line_official_status_itv.del = setTimeout(Canary_del_line_message.bind(this, line_official_id, 2, 2), 1000);
        return;
      }

      $current.trigger('click');
      console.log("syncing... ", this.sync_idx, this.sync_cnt, ", " , $current.attr('title'), id);
      emit_sync_status(del_line_official_status, (this.sync_idx+1) + " / " + this.sync_cnt);
      sync_history_img();
      this.syncing = true;
      this.syncing_end = this.syncing_start = + new Date();
    }

  };

  require(['KxmFq'], function(f) {
    var uOCpn = f[0];
    var o = uOCpn.showMessageNotification;
    uOCpn.showMessageNotification = function(t, e, i, n) {
      var user = e.DnpcOiNSqb();
      if (!user) {
        console.log("no user.attributes", t);
        return o.call(this, t, e, i, n);
      }
      var id = user.attributes.mid;
      var picturePath = user.attributes.picturePath;
      var parsing_url = require('hObQY');
      var url = parsing_url.lxHruErudM(picturePath);

      if (!picturePath) {
        url = "/res/img/noimg/img_friend_profile_46x46_3.png";
      }

      if (!id_img_base64_mapping[id]) {
        later_send_for_img_load_ids.push(id);
        // if error
        var xhr = new XMLHttpRequest();
        xhr.onload = function(e) 
        //xhr.onreadystatechange = function()
        {
          if (this.readyState == 4 && this.status == 200){
            //this.response is what you're looking for
            _getImgBase64(this.response, function(base64) {
              if (base64) {
                id_img_base64_mapping[id] = base64;
              }

              {
                var idx = later_send_for_img_load_ids.indexOf(id);
                later_send_for_img_load_ids.splice(idx, 1);

                // update image
                var l = later_send_for_img_load_data.length;
                while(l--) {
                  var j = later_send_for_img_load_data[l].chat.length;
                  var miss = 0;
                  while(j--) {
                    var c = later_send_for_img_load_data[l].chat[j];
                    if (!c.icon_base64) {
                      miss++;
                      if (id_img_base64_mapping[c.from]) {
                        c.icon_base64 = id_img_base64_mapping[c.from];
                        miss--;
                      }
                    }
                  }

                  if (miss <= 0) {
                    var _chats = later_send_for_img_load_data.splice(l, 1);
                    if (_chats[0]) {
                      console.log("chat send from llater_send_for_img_load_data");
                      $.fn.Canary_add_chat([_chats[0]]);
                    }
                    else {
                      console.log("no chats", later_send_for_img_load_data);
                    }
                  }
                }
              }
            });
          }
        }
        //https://developer.mozilla.org/zh-TW/docs/Web/API/XMLHttpRequest/open
        xhr.open('GET', url);
        xhr.responseType = 'blob';
        xhr.send();  
      }
      return o.call(uOCpn, t, e, i, n);
    }
  });

  require(['Fmkcl'], function(f) {
    var o = f.oamDqysveK;
    var F = f.FkWhCsvojO;

    f.FkWhCsvojO = function(t, e, i, n, s, r) {
      if ($.fn.is_debug_for_log) {
        console.log(t, e, i, n, s, r, "get sender img");
      }
      //console.log(later_send_for_content_img);
      return F.call(this, t, e, i, n, s, r);
    }

    f.oamDqysveK = function (t, e, i, n) {
      if ($.fn.is_debug_for_log) {
        console.log(t, e, i, n, "async image");
      }

      //if (url_id_mapping[t]) {
      //  getImgBase64(t, function(base64) {
      //    id_img_base64_mapping[url_id_mapping[t]] = base64;
      //    delete url_id_mapping[t];
      //  });
      //}
      // all group icon image could download via this function
      return o.call(this, t, e, i, n);
      //var org_i = i;
      //return o.call(this, t, e, function(t) {
      //  _getImgBase64(t, function(base64) {
      //    if (!id_img_base64_mapping[]) {
      //      id_img_base64_mapping[] = base64;
      //    }
      //  });
      //  return org_i.call(this, t);
      //}, n);
    };
  });

  var check_load_history = function($li, cb, group) {
    var b = true;
    var c = false;
    if (cb) {
      cb($li, group);
    }

    if (b && !$.fn.sync_old.sync_cnt) {
      $.fn.sync_old.sync_idx = -1;
      $.fn.sync_old.sync_cnt = $li.length;
      $.fn.sync_old.syncing = true;
      $.fn.sync_old.syncing_end = $.fn.sync_old.syncing_start = + new Date();

      clearTimeout(del_line_official_status_itv.end_copy_user_image_and_name);

      //var $current = $($li[$.fn.sync_old.sync_idx]);
      $.fn.sync_old.sync.call($.fn.sync_old);
      //$current.trigger('click');
    }

  };

  var lazy_get_img = function(eles, $li, cb, retry) {
    var need_lazy_get_imgs = [];
    retry = retry || 0;
    retry++;
    $(eles).each(function() {
      var $this = $(this); 
      var src = $this.find('img').attr('src');
      var is_no_img = (src.search('img') != -1);
      var retry_max = 3; 
      var is_force_stop = retry > retry_max;
      if (!is_force_stop && is_no_img) {
        need_lazy_get_imgs.push(this);
      }
      else {
        if (is_force_stop) {
          console.log("is_force_stop:", src, $this.data('mid'), $this.attr('title'));
        }

        getImgBase64(src, function(base64) {
          var chatid = $this.find('.chatList').data('chatid');

          if (!chatid) {
            // friend list
            chatid = $this.data('mid');
          }

          var group = {
            id: chatid,
            name: $this.attr('title'),
            icon_base64: base64,
            me_id: $.fn.me_id
          };

          id_display_name_mapping[group.id] = group.name;
          id_img_base64_mapping[group.id] = base64;

          check_load_history($li, cb, group);
        });
      }
    });

    if (need_lazy_get_imgs.length) {
      setTimeout(lazy_get_img.bind(this, eles, $li, cb, retry), 3000);
    }
  };

  var update_chat_list_body = function($li, cb) {
    // [got, miss]
    var need_async_imgs = _.partition($li, function(item) {
      return $(item).find('img').attr('src').search('img') != -1;
    });
    var lazy_load_imgs = need_async_imgs[0];
    var exist_cache_imgs = need_async_imgs[1];

    var batch_sync = [];
    //var do_batch_sync = function($li, group) {
    //  if (!$.fn.sync_old.sync_cnt) {
    //    $.fn.Canary_add_chat(batch_sync, 'update_group');
    //  }
    //};

    if (lazy_load_imgs.length) {
      lazy_get_img(lazy_load_imgs, $li, function($li, group) {
        batch_sync.push(group);
        //$.fn.sync_old.sync_cnt--;
        cb($li, group, batch_sync);
      });
    }

    if (!$li.length) {
      // force schedule once no chat
      //$.fn.sync_old.sync_idx = -1;
      //$.fn.sync_old.sync_cnt = $li.length;
      //$.fn.sync_old.syncing = true;
      //$.fn.sync_old.syncing_end = $.fn.sync_old.syncing_start = + new Date();
      //$.fn.sync_old.sync.call($.fn.sync_old);
      Canary_sync_group();
    }

    $(exist_cache_imgs).each(function(i) {
      var $this = $(this); 
      var src = $this.find('img').attr('src');
      getImgBase64(src, function(base64) {
        var chatid = $this.find('.chatList').data('chatid');
        var group = {
          id: chatid,
          name: $this.attr('title'),
          icon_base64: base64,
          me_id: $.fn.me_id
        };

        batch_sync.push(group);

        id_display_name_mapping[group.id] = group.name;
        id_img_base64_mapping[group.id] = base64;

        //$.fn.Canary_add_chat([group], 'update_group');
        //$.fn.sync_old.sync_cnt--;
        check_load_history($li, function($li) {
          cb($li, null, batch_sync);
        });

        //var b = true;
        //var c = false;
        //if (b && !$.fn.sync_old.sync_cnt) {
        //  $.fn.sync_old.sync_idx = -1;
        //  $.fn.sync_old.sync_cnt = $li.length;
        //  $.fn.sync_old.syncing = true;
        //  $.fn.sync_old.syncing_end = $.fn.sync_old.syncing_start = + new Date();

        //  var $current = $($li[$.fn.sync_old.sync_idx]);
        //  $.fn.sync_old.sync.call($.fn.sync_old);
        //  //$current.trigger('click');
        //}
      });
    });

  };

  require(["marionette"], function(r) {
    var a = r.CollectionView.prototype._renderChildren
    r.CollectionView.prototype._renderChildren = function() {
      a.call(this);
      if (this.$el.is('#wrap_chat_list')) {
        if ($.fn.is_debug_for_log) {
          console.log(this, "init group list");
        }
        var $li = $('#_chat_list_body li');

        if ($.fn.sync_old.sync_idx == -1 || del_line_official_status >= 7) {
          console.log("already kick off, 81");
          return;
        }

        $.fn.sync_old.sync_cnt = $li.length;
        $.fn.sync_old.$el= $li;
        var li_cnt = $li.length;
        // schedule out for wait indexeddb save img once new group
        update_chat_list_body($li, function($li, group, batch_sync) {
          li_cnt--;
          if (!li_cnt) {
            $.fn.sync_old.sync_cnt = 0;
            $.fn.Canary_add_chat(batch_sync, 'update_group');
            //if (del_line_official_status == 6) {
            //  //$.fn.sync_old.sync_cnt = $li.length;
            //  //$.fn.sync_old.$el = $li;
            //  del_line_official_status = 7;
            //  emit_sync_status(del_line_official_status);
            //  Canary_sync_group();
            //}
          }
          //$.fn.sync_old.sync_cnt--;
          //if (!$.fn.sync_old.sync_cnt) {
          //  $.fn.Canary_add_chat(batch_sync, 'update_group');
          //}
        });

        //// [got, miss]
        //var need_async_imgs = _.partition($li, function(item) {
        //  return $(item).find('img').attr('src').search('img') != -1;
        //});
        //var lazy_load_imgs = need_async_imgs[0];
        //var exist_cache_imgs = need_async_imgs[1];

        //var batch_sync = [];
        //var do_batch_sync = function($li, group) {
        //  if (!$.fn.sync_old.sync_cnt) {
        //    $.fn.Canary_add_chat(batch_sync, 'update_group');
        //  }
        //};

        //if (lazy_load_imgs.length) {
        //  lazy_get_img(lazy_load_imgs, $li, function($li, group) {
        //    batch_sync.push(group);
        //    $.fn.sync_old.sync_cnt--;
        //    do_batch_sync($li);
        //  });
        //}

        //if (!$li.length) {
        //  // force schedule once no chat
        //  //$.fn.sync_old.sync_idx = -1;
        //  //$.fn.sync_old.sync_cnt = $li.length;
        //  //$.fn.sync_old.syncing = true;
        //  //$.fn.sync_old.syncing_end = $.fn.sync_old.syncing_start = + new Date();
        //  //$.fn.sync_old.sync.call($.fn.sync_old);
        //  Canary_sync_group();
        //}

        //$(exist_cache_imgs).each(function(i) {
        //  var $this = $(this); 
        //  var src = $this.find('img').attr('src');
        //  getImgBase64(src, function(base64) {
        //    var chatid = $this.find('.chatList').data('chatid');
        //    var group = {
        //      id: chatid,
        //      name: $this.attr('title'),
        //      icon_base64: base64,
        //      me_id: $.fn.me_id
        //    };

        //    batch_sync.push(group);

        //    id_display_name_mapping[group.id] = group.name;
        //    id_img_base64_mapping[group.id] = base64;

        //    //$.fn.Canary_add_chat([group], 'update_group');
        //    $.fn.sync_old.sync_cnt--;
        //    check_load_history($li, function($li) {
        //      do_batch_sync($li);
        //    });

        //    //var b = true;
        //    //var c = false;
        //    //if (b && !$.fn.sync_old.sync_cnt) {
        //    //  $.fn.sync_old.sync_idx = -1;
        //    //  $.fn.sync_old.sync_cnt = $li.length;
        //    //  $.fn.sync_old.syncing = true;
        //    //  $.fn.sync_old.syncing_end = $.fn.sync_old.syncing_start = + new Date();

        //    //  var $current = $($li[$.fn.sync_old.sync_idx]);
        //    //  $.fn.sync_old.sync.call($.fn.sync_old);
        //    //  //$current.trigger('click');
        //    //}
        //  });
        //});
      }
      //console.log(this, "init group list");
    }
  });

  //require(["durNe", "marionette", "backbone"], function(d, t, e) {
  //  //var e2eeDecryptChannel = e.Wreqr.radio.channel("e2eeDecryptChannel")
  //  //u.commands.execute("ADD_QUE_DECRYPT_MSG", this)
  //  return;
  //  Backbone.Wreqr.radio._channels.e2eeDecryptChannel.commands.getHandler = function(t) { 
  //    var e = this._wreqrHandlers[t];
  //    if (e)
  //      return function() {
  //        var t = Array.prototype.slice.apply(arguments);
  //        var a =  e.callback.apply(e.context, t);
  //        var chats = {};
  //        //console.log(a, this, t);
  //        t = t[0];
  //        var chatId = t.attributes.chatId;
  //        var message = t.attributes.message;

  //        chats[chatId] = {
  //          lastMessageTime: '',
  //          id: chatId,
  //          me_id: $.fn.me_id,
  //          title: '',
  //          chat: []
  //        };

  //        var chat = {
  //          title:'',
  //          chat: message.text,
  //          time: message.createdTime,
  //          from: message.from,
  //          cid: chatId,
  //          me: ""
  //        }; 

  //        if (message.from == $.fn.me_id) {
  //          chat['me'] =  $.fn.me_id
  //        }


  //        chats[chatId].chat.push(chat);
  //        chats[chatId].lastMessageTime = message.createdTime;
  //        t.id = chatId;
  //        send_chat.call(t, 'xx', chats);

  //        return a;
  //      }
  //  };
  //  //Backbone.Wreqr.radio._channels.e2eeDecryptChannel.commands._wreqrHandlers.ADD_QUE_DECRYPT_MSG
  //  //Backbone.Wreqr.radio._channels["e2eeDecryptChannel"] = (function() {
  //  //  return e2eeDecryptChannel;
  //  //})();
  //});

  require(['auRxa'], function(c) {
    var org = c.sendLog;

    c.sendLog = function(e, i, n, s, r) {
      console.error("err!", e, i, n, s, r);
      //Canary_logout();
      //org.call(this, e, i, n, s, r);
    };
  });

  require(["common/imageCache/MessageThumbnailCollection", 
    "common/imageCache/MessageThumbnailStore",
    'underscore', 'mustacheExtend'], function(c, s, _, m) {
    var chats = {};
    var profiles = [];
    var mismatch_chat_arr = []; //{localId: chat}
    var mismatch_img_arr = []; //{localId: base64}
    var org  = Backbone.Model.prototype.FyysHExGkj;
    var tsLlgebyUH = c.tsLlgebyUH;
    var findIdxById = function (list, id) {
      for (var i = 0; i < list.length; i++) {
        if (list[i].id == id) {
          return i;
        }
      }
      return -1;
    };

    var get_runtime_display_name = function(t) {
      var view_ele = get_view(t, this);
      var from_display_name = "";
      if (view_ele) {
        from_display_name = view_ele.$el.find('div').filter(function(){ return $(this).attr('class').search('Ttl') != -1;}).html();
        if ($.fn.is_debug_for_log) {
          console.log(view_ele);
        }
      }
      else {
        var o = require('hdmgI');
        var v = new o({model: this});
        var r = v.render();
        from_display_name = r.$el.find('b').html();
        //console.log("render html is ", r.$el.html(), r);
      }

      return from_display_name;
    };

    // background runtime sync
    Backbone.Model.prototype.FyysHExGkj = function(t, e, n) {
      var get_from_display_name = function(t) {
        t = t || this;
        var from_display_name = get_runtime_display_name.call(this, t);
        if (from_display_name) {
          id_display_name_mapping[this.attributes.message.from] = from_display_name;
        }
      }
      var fetchLatestImage = function(t) {
        get_from_display_name.call(this, t);

        var c = require("common/imageCache/MessageThumbnailCollection");
        var o = c.makeOption(this, 101);
        var l = _.extend({}, this.attributes.message); // old one
        var to = this.get("chatId");
 
        c.fetchImage(to, this.llPvUXTLsQ(), o.url,
          function(b, e) { 
            _getImgBase64(b.attributes.blob, function(base64) { 
              //console.log(base64)
              send_one_chat(l, to, l, base64);
            });
          }
        );
      };

      if (e && t) {
        //if (t.message && t.message.text) {
        //  if (!chats[t.chatId]) {
        //    chats[t.chatId] = {
        //      lastMessageTime: '',
        //      id:t.chatId,
        //      me_id: $.fn.me_id,
        //      title: '',
        //      icon_base64: "",
        //      chat: []
        //    };

        //    if (id_img_base64_mapping[t.chatId]) {
        //      chats[t.chatId].icon_base64 = id_img_base64_mapping[t.chatId];
        //    }
        //  }

        //  var chat = {
        //    title:'',
        //    chat: t.message.text,
        //    //t: t.message.createdTime,
        //    time: t.message.createdTime,
        //    from: t.message.from,
        //    cid: this.cid,
        //    icon_base64: ""
        //  }; 

        //  var from_display_name = get_runtime_display_name.call(this, t);
        //  //var view_ele = get_view(t, this);
        //  //var from_display_name = "";
        //  //if (view_ele) {
        //  //  from_display_name = view_ele.$el.find('div').filter(function(){ return $(this).attr('class').search('Ttl') != -1;}).html();
        //  //  if ($.fn.is_debug_for_log) {
        //  //    console.log(view_ele);
        //  //  }
        //  //}
        //  //else {
        //  //  var o = require('hdmgI');
        //  //  var v = new o({model: this});
        //  //  var r = v.render();
        //  //  from_display_name = r.$el.find('b').html();
        //  //  //console.log("render html is ", r.$el.html(), r);
        //  //}

        //  if (from_display_name) {
        //    id_display_name_mapping[this.attributes.message.from] = from_display_name;
        //  }
        //  //later assign in send_chat.call
        //  //chat['from_display_name'] = id_display_name_mapping[this.attributes.message.from];
        //  if (t.message.id == this.attributes.message.id) {
        //    //id_display_name_mapping[this.attributes.message.from] = from_display_name;
        //    //chat['from_display_name'] = id_display_name_mapping[this.attributes.message.from];
        //  }
        //  else {
        //    if ($.fn.is_debug_for_log) {
        //      console.log("t and this is different, t:", t, ", this:", this);
        //    }
        //  }
        //  //chat['me'] = "";
        //  //if (t.message.from != $.fn.me_id) {
        //  //}
        //  //else {
        //  //  chat['me'] = $.fn.me_id;
        //  //}

        //  chats[t.chatId].chat.push(chat);
        //  chats[t.chatId].lastMessageTime = t.message.createdTime;
        //}
        //else {}
        if (!(t.message && t.message.text)) {
          //console.log(t.chatId, t.message.text, chat);
          if ($.fn.is_debug_for_log) {
            console.log(t);
          }
          //if (t && t.groupInfo) {
          //  //add new group
          //  var chatid = t.groupInfo.id; // to
          //  var $new_ele = $('#_chat_list_body li').filter(function() {
          //    return $(this).children('div').data('chatid') == chatid;
          //  });

          //  if ($new_ele.length) {
          //    var src = $new_ele.find('img').attr('src');
          //    getImgBase64(src, function(base64) {
          //      var group = {
          //        id: chatid,
          //        name: $new_ele.attr('title'),
          //        icon_base64: base64,
          //        me_id: $.fn.me_id
          //      };

          //      id_img_base64_mapping[group.id] = base64;

          //      $.fn.Canary_add_chat([group], 'update_group');
          //    });
          //  }
          //}
          //else 
            if (t && t.message && t.message.contentMetadata && !t.message.text && t.message.contentMetadata.STKVER) {
            send_one_chat(t, t.chatId, t.message, this); // sticker
          }
          //else if (t && t.message && t.message.contentMetadata) {
          //  if (!t.message.text && t.message.contentMetadata && !t.message.contentMetadata.STKVER) {
          //    if (!t.message.text && t.message.contentMetadata && t.message.contentMetadata.OBS_POP == "b") {
          //      if (t.localId != this.get('localId')) {
          //        if ($.fn.is_debug_for_log) {
          //          console.log(t, this, 'get late img, save for prevois use');
          //        }
          //        //mismatch_chat_arr.push({localId: t.localId,  
          //        //chats[t.chatId] && chats[this.id].lastMessageTime == t.lastMessageTime) {
          //      }
          //      var from_display_name = get_runtime_display_name.call(this, t);
          //      if (from_display_name) {
          //        id_display_name_mapping[this.attributes.message.from] = from_display_name;
          //      }

          //      if (t.message.from == this.attributes.message.from) {
          //        //id_display_name_mapping[this.attributes.message.from] = from_display_name;
          //      }
          //      else {
          //        if ($.fn.is_debug_for_log) {
          //          console.log("t and this is different, t:", t, ", this:", this);
          //        }
          //      }
          //      // send image
          //      // 'this' is latest one
          //      var c = require("common/imageCache/MessageThumbnailCollection");
          //      var o = c.makeOption(this, 101);
          //      //var deep = function(a, b) {
          //      //  return _.isObject(a) && _.isObject(b) ? _.extend(a, b, deep) : b;
          //      //};
          //      //var l = _.extend({}, {attributes: this.attributes}, deep); // old one
          //      var l = _.extend({}, this.attributes.message); // old one
          //      var to = this.get("chatId");
          //      var do_fetchImage = function(l) {
          //        var that = this;
          //        return c.fetchImage(to, this.llPvUXTLsQ(), o.url,
          //          function(b, e) { 
          //            // old one, current that is latest
          //            _getImgBase64(b.attributes.blob, function(base64) { 
          //              //console.log(base64)
          //              send_one_chat(l, to, l, base64);
          //              //second is latest image
          //              {
          //                var c = require("common/imageCache/MessageThumbnailCollection");
          //                var o = c.makeOption(that, 101);
          //                c.fetchImage(that.get("chatId"), that.llPvUXTLsQ(), o.url,
          //                  function(b, e) { 
          //                    _getImgBase64(b.attributes.blob, function(base64) { 
          //                      //console.log(base64)
          //                      send_one_chat(that, that.attributes.chatId, that.attributes.message, base64);
          //                    });
          //                  }
          //                );
          //              }
          //            });
          //            //console.log('bbbbb', b, e)
          //          }
          //        );
          //      };
          //      do_fetchImage.call(this, l);
          //      //tsLlgebyUH.call(c, this, 101, function(b) {
          //      //  _getImgBase64(b, function(base64) {
          //      //    send_one_chat(t, t.chatId, t.message, b);
          //      //  });
          //      //});
          //    }
          //    else if ($.fn.is_debug_for_log) {
          //      console.log(t, 'no chat text');
          //    }
          //  }
          //  else {
          //    send_one_chat(t, t.chatId, t.message, this);
          //  }
          //}
        }
      }
      else if (t && t.lastMessageTime) {
        if (chats[this.id] && chats[this.id].lastMessageTime == t.lastMessageTime) {
          // later send
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
            var L = require("cZAte");
            if ($.fn.is_debug) {
              L.isFocus = function () { return this._focusStatus; };
            }
            else {
              L.isFocus = function () { return false; };
            }
          }
        }
      }

      //if (this.attributes && this.attributes.message && this.attributes.message.contentMetadata && this.attributes.message.contentMetadata.OBS_POP == 'b') {
      //  fetchLatestImage.call(this, t);
      //  //console.log("this is ", this.attributes.message.createdTime, this);
      //}
      
      //if (t && t.message && t.message.contentMetadata && t.message.contentMetadata.OBS_POP == 'b')  {
      //  console.log("t is ", t.message.createdTime, t);
      //}
      //console.log("now is", this, t);

      //if (this.attributes && this.attributes.message && this.attributes.message.contentMetadata && this.attributes.message.contentMetadata.OBS_POP == 'b' &&
//t && t.message && t.message.contentMetadata && t.message.contentMetadata.OBS_POP == 'b') { 
//t.message.createdTime == this.attributes.message.createdTime) {
      //  // no this.get('localId')
      //  fetchLatestImage.call(this, t);
      //}

      if (this.attributes && this.attributes.message) {
        // cache display_name
        get_from_display_name.call(this, t);
      }

      if (this.attributes && this.attributes.message && this.attributes.message.contentMetadata && this.attributes.message.contentMetadata.OBS_POP == 'b' ) {
        fetchLatestImage.call(this, t);
      }

      if (this.attributes && this.attributes.groupInfo) {
        //add new group if not exist

        var chatid = this.attributes.chatId;
        if (!id_img_base64_mapping[chatid]) {
          var src = this.attributes.groupInfo.picturePath;
          var parsing_url = require('hObQY');
          var url = parsing_url.lxHruErudM(src);
          var name = this.attributes.groupInfo.name;

          if ($.fn.is_debug_for_log) {
            console.log(m, this, e, n, "create new group", t); 
          }

          getImgBase64(src, function(base64) {
            var group = {
              id: chatid,
              name: name,
              icon_base64: base64,
              me_id: $.fn.me_id
            };

            id_display_name_mapping[group.id] = group.name;
            id_img_base64_mapping[group.id] = base64;

            $.fn.Canary_add_chat([group], 'update_group');
          });
        }
      }

      if (t && t.message && t.message.text) {
        //(this.attributes && this.attributes.message && this.attributes.message.text)
        //send_one_chat(this, this.get("chatId"), this.attributes.message, this);

        // t is current and this is previous
        send_one_chat(t, t.chatId, t.message, this);
      }

      if (this.parse) {
        var p = this.parse;
        this.parse = function(t, e) {
          if (this.attributes && this.attributes.message && this.attributes.message.contentMetadata && this.attributes.message.contentMetadata.OBS_POP == 'b' ) {
            fetchLatestImage.call(this);
          }
          return p.call(this, t, e);
        }
      }

      if (this.id == "profile") {
        $.fn.me = this.attributes.value.displayName;
        $.fn.me_id = this.attributes.value.mid;
      }

      if (this.id == "CH_localId") {
        $.fn.me = this.collection._byId.profile.attributes.value.displayName;
        $.fn.me_id = this.collection._byId.profile.attributes.value.mid;

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
        console.log('now is ', del_line_official_status);
        emit_sync_status(del_line_official_status);

        clearTimeout(del_line_official_status_itv.del);
        del_line_official_status_itv.del = setTimeout(Canary_del_line_message.bind(this), 1000);
      }
      else if (del_line_official_status == 4 && t && t.chatId == line_official_id) {
        var $line_official = $('.chatList').filter(function(){ return $(this).data('chatid') == line_official_id });
        if ($line_official.length) {
          console.log("retry del chat");
          del_line_official_status = 3;
          console.log('now is ', del_line_official_status);
          emit_sync_status(del_line_official_status);
          Canary_del_line_message(line_official_id, 1, 2);
        }
        else {
          del_line_official_status = 5;
          console.log('now is ', del_line_official_status);
          emit_sync_status(del_line_official_status);
        }
        //$.fn.is_debug = debug_status;
      }

      if ($.fn.is_debug_for_log) {
        console.log(m, this, e, n, "XX", t); 
      }
      //if (this.KEY_LOCAL_ID) {
      //  console.log(this.attributes.chatId, this.attributes.message.text);
      //}
      //return org.call(this, e, i);
      //if (!this || !t || !e) {
      //  console.log(org, this, t, e, "error");
      //}
      return org.call(this, t, e);
    };
  });

  require(["common/imageCache/MessageThumbnailCollection"], function(c) {
    var createImage = c.createImage;
    var getImageFromCache = c.getImageFromCache;
    c.getImageFromCache = function(e) {
      //console.log(e);
      return getImageFromCache.call(this, e);
    } 

    c.createImage = function(t, i, n) {
      // t: line_id
      // i: 10193779120548
      // n: blob
      later_send_for_content_img = _.reject(later_send_for_content_img, function(v) { 
        //var got = v.attributes.message.id == i && v.attributes.message.from == t;
        var got = v.attributes.message.id == i && v.attributes.message.to == t;
        if (got) {
          _getImgBase64(n, function(base64) {
            send_one_chat(v, v.attributes.chatId, v.attributes.message, base64);
          });
        }
        return got;
      });
      return createImage.call(this, t, i, n);
    }
  });

  //window.onbeforeunload = function() {
  //  console.log("unload");
  //  return null;
  //};
});
