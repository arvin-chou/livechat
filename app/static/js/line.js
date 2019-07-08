$(document).ready(function() {
  var is_admin = $('ul.dropdown-menu a').filter(function(){return $(this).attr('href') == '/users/list/';}).length > 0;
  if (!is_admin) {
    $('.fa.fa-user-o').closest('li').hide();

    //$('a>.fa-search').parent().each(function(){
    //  this.dataset.originalTitle = "{{_("show your qrcode")}}"
    //});
    //$('[data-toggle="tooltip"]').tooltip();
  }
});
