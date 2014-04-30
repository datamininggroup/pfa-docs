// https://github.com/ghiculescu/jekyll-table-of-contents

// Copyright (c) 2013 Alex Ghiculescu

// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:

// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.

// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
// THE SOFTWARE.

(function($){
  $.fn.toc = function(options) {
    var defaults = {
      noBackToTopLinks: false,
      title: '',
      listType: 'ul', // values: [ol|ul]
      showSpeed: 'slow'
    },
    settings = $.extend(defaults, options);
    
    var headers = $('.content h1, .content h2, .content h3, .content h4, .content h5, .content h6').not('.page-title'), output = $(this);
    if (!headers.length || headers.length < 3 || !output.length) {
      return;
    }
    
    var get_level = function(ele) { return parseInt(ele.nodeName.replace("H", ""), 10); }
    var highest_level = headers.map(function(_, ele) { return get_level(ele); }).get().sort()[0];
    var return_to_top = '<i class="icon-arrow-up back-to-top"> </i>';
    
    var level = get_level(headers[0]),
      this_level,
      html = settings.title + " <"+settings.listType+">";
    headers.on('click', function() {
      if (!settings.noBackToTopLinks) {
        window.location.hash = this.id;
      }
    })
    .addClass('clickable-header')
    .each(function(_, header) {
      this_level = get_level(header);
      if (!settings.noBackToTopLinks && this_level === highest_level) {
        $(header).addClass('top-level-header').after(return_to_top);
      }
      if (this_level === level) // same level as before; same indenting
        html += "<li><a href='#" + header.id + "'>" + header.innerHTML + "</a>";
      else if (this_level < level) // higher level than before; end parent ol
        html += "</li></"+settings.listType+"></li><li><a href='#" + header.id + "'>" + header.innerHTML + "</a>";
      else if (this_level > level) // lower level than before; expand the previous to contain a ol
        html += "<"+settings.listType+"><li><a href='#" + header.id + "'>" + header.innerHTML + "</a>";
      level = this_level; // update for the next one
    });
    html += "</"+settings.listType+">";
    if (!settings.noBackToTopLinks) {
      $(document).on('click', '.back-to-top', function() {
        $(window).scrollTop(0);
        window.location.hash = '';
      });
    }
    output.hide().html(html);
    // if (0 !== settings.showSpeed) {
    //   output.hide().html(html).show(settings.showSpeed);
    // } else {
    //   output.html(html);
    // }
  };
})(jQuery);
