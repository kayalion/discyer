var discyerApp = discyerApp || {};

discyerApp = (function($, undefined) {
  var $window = $(window);
  var $document = $(document);
  var $navbar = $('.navbar');
  var $navbarCollapse = $('#navbarToggleExternalContent');
  var $navbarBrand = $('.navbar-brand');

  var $formSignin = $('.form-signin');
  var $formSigninInput = $('#inputToken');
  var $formSigninButton = $('button[type=submit], input[type=submit]', $formSignin);

  var $formSettingsPlayFirst = $('input[name=settings-play-first]').first();

  var $videoWrapper = $('.video-wrapper');
  var $visibleAuthorized = $('.visible-authorized');
  var $visibleAnonymous = $('.visible-anonymous');

  var service = window.discyerService;

  var identity = null;
  var player = null;
  var folder = null;
  var list = null;
  var playlistType = 'folder';
  var playlist = [];
  var videos = [];

  var _hasLocalStorage = undefined;

  var _initialize = function() {
    var playFirstOnly = 1;

    if (hasLocalStorage()) {
      playFirstOnly = getFromLocalStorage('play.first', playFirstOnly);
    }
    
    if (playFirstOnly == 1) {
      $formSettingsPlayFirst.prop('checked', true);
    }

    $formSettingsPlayFirst.on('click', function() {
      if (hasLocalStorage()) {
        setToLocalStorage('play.first', $formSettingsPlayFirst.prop('checked') ? 1 : 0);
      }
    });

    $document.on('click', '.navbar-brand, .release-full-title', function(event) {
      event.preventDefault();

      $('.navbar-toggler').trigger('click');
    });

    $formSigninInput.on('blur keyup click', function(e) {
      $formSigninInput.removeClass('is-invalid');
      $formSigninButton.attr('disabled', $formSigninInput.val() == '');
    });
    $formSignin.on('submit', function(e) {
      e.preventDefault();

      onSignin();
    });
    $formSigninButton.attr('disabled', $formSigninInput.val() == '');

    $document.on('click', '.signoff', function(event) {
      event.preventDefault();

      onSignoff();

      $('.navbar-toggler').trigger('click');
    });

    $document.on('click', '.folder', function(event) {
      event.preventDefault();

      onFolderSelect($(this));
    });

    $document.on('click', '.wantlist', function(event) {
      event.preventDefault();

      onWantlistSelect();
    });

    $document.on('click', '.list', function(event) {
      event.preventDefault();

      onListSelect($(this));
    });

    $document.on('click', '.play-next-release', function(event) {
      event.preventDefault();

      playlist = [];
      playNext();
    });
    $document.on('click', '.play-next-video', function(event) {
      event.preventDefault();

      playNext();
    });
    $document.on('click', '.play-video', function(event) {
      event.preventDefault();

      var title = $(this).text();

      playlist = videos.slice();
      while (playlist.length != 0) {
        video = playlist.shift();

        if (video.title == title) {
          playVideo(video);

          break;
        }
      }
    });

    $navbarCollapse.on('show.bs.collapse', function () {
      $navbarBrand.addClass('d-none');
    });

    $navbarCollapse.on('hidden.bs.collapse shown.bs.collapse', function () {
      resizePlayer();

      if ($navbarCollapse.hasClass('show')) {
        $navbarBrand.addClass('d-none');
      } else {
        $navbarBrand.removeClass('d-none');
      }
    });
    $window.on('resize', function() {
      resizePlayer();
    });
  };

  var onSignin = function() {
    $formSigninButton.html('Sign in <span class="fa fa-spin fa-spinner"></span>');
    $formSigninButton.attr('disabled', true);

    service.setAccessToken($formSigninInput.val());
    service.getIdentity(onSigninSuccess, onSigninError);
  };

  var onSigninSuccess = function(data) {
    setLoading(true);

    identity = data;

    service.getProfile(identity.username, onGetProfileSuccess, onError);
    service.getFolders(identity.username, onGetFoldersSuccess, onError);
    service.getLists(identity.username, onGetListsSuccess, onError);

    $('.profile-href').attr('href', 'https://www.discogs.com/user/' + identity.username);
    $('.profile-name').html(identity.username);

    $visibleAnonymous.addClass('d-none');
    $visibleAuthorized.removeClass('d-none');
    $formSigninButton.html('Sign in');

    resizePlayer();
  };

  var onSigninError = function(data) {
    $formSigninInput.addClass('is-invalid');

    $formSigninButton.html('Sign in');
  };

  var onSignoff = function() {
    setLoading(true);

    identity = null;
    folder = null;
    playlist = [];
    videos = [];
    player.stopVideo();

    $('.navbar-brand').text('');
    document.title = 'DiSCYeR';

    $formSigninInput.val('');
    $formSigninButton.attr('disabled', true);

    $visibleAuthorized.addClass('d-none');
    $visibleAnonymous.removeClass('d-none');

    service.setAccessToken(null);
    service.clearCache();

    setLoading(false);
  };

  var onGetProfileSuccess = function(data) {
    var currency = data.curr_abbr;

    switch (currency) {
      case 'EUR':
        currency = '€';

        break;
      case 'USD':
        currency = '$';

        break;
      case 'GBP':
        currency = '£';

        break;
    }

    $('.release-market-currency').html(currency);
  }

  var onGetFoldersSuccess = function(data) {
    // update folder list
    var list = $('<ul>');
    for (key in data.folders) {
      var f = data.folders[key];

      if (f.count == 0) {
        continue;
      }

      list.append('<li><a href="#" class="folder" data-id="' + f.id + '" data-count="' + f.count + '">' + f.name + ' (' + f.count + ')</a></li>');
    }
    list.append('<li><a href="#" class="wantlist">Wantlist</a></li>');
    $('.folders').html(list);

    // select first folder
    onFolderSelect($('.folders .folder:first'));
  };

  var onGetListsSuccess = function(data) {
    // update list list
    var list = $('<ul>');
    for (key in data.lists) {
      var l = data.lists[key];

      list.append('<li><a href="#" class="list" data-id="' + l.id + '">' + l.name + '</a></li>');
    }
    $('.lists').html(list);
  };

  var onFolderSelect = function($folder) {
    $('#modal-playlist-select').modal('hide');
    setLoading(true);

    // keep folders details
    folder = {
      id: $folder.data('id'),
      count: $folder.data('count'),
      name: $folder.html()
    };

    // reset playlist and play next video
    playlistType = 'folder';
    playlist = [];
    playNext();

    // select current folder
    $('.folders a').css('font-weight', 'normal');
    $('.lists a').css('font-weight', 'normal');
    $('.folders a[data-id=' + folder.id + ']').css('font-weight', 'bold');
    $('.current-folder').html(folder.name);

    $('.current-playlist-wantlist').addClass('d-none');
    $('.current-playlist-list').addClass('d-none');
    $('.current-playlist-folder').removeClass('d-none');
  };

  var onWantlistSelect = function() {
    $('#modal-playlist-select').modal('hide');
    setLoading(true);

    folder = null;

    // reset playlist and play next video
    playlistType = 'wantlist';
    playlist = [];
    playNext();

    // select the wantlist
    $('.folders a').css('font-weight', 'normal');
    $('.folders a.wantlist').css('font-weight', 'bold');
    $('.lists a').css('font-weight', 'normal');

    $('.current-playlist-folder').addClass('d-none');
    $('.current-playlist-list').addClass('d-none');
    $('.current-playlist-wantlist').removeClass('d-none');
  }

  var onListSelect = function($list) {
    $('#modal-playlist-select').modal('hide');
    setLoading(true);

    folder = null;
    list = {
      'id': $list.data('id'),
      'name': $list.html()
    }

    // reset playlist and play next video
    playlistType = 'list';
    playlist = [];
    playNext();

    // select the wantlist
    $('.folders a').css('font-weight', 'normal');
    $('.lists a').css('font-weight', 'normal');
    $('.lists a[data-id=' + list.id + ']').css('font-weight', 'bold');
    $('.current-list').html(list.name);

    $('.current-playlist-folder').addClass('d-none');
    $('.current-playlist-wantlist').addClass('d-none');
    $('.current-playlist-list').removeClass('d-none');
  }

  var playNext = function() {
    setLoading(true);

    if (playlist.length != 0) {
      // video queue is filled, play the next
      var video = playlist.shift();
      playVideo(video);

      if ($formSettingsPlayFirst.is(':checked')) {
        playlist = [];
      }
    } else if (playlistType == 'folder') {
      // no video queue, get random release from current folder and play
      service.getRandomReleaseFromFolder(identity.username, folder.id, folder.count, function(data) {
        service.getRelease(data.id, function(release) {
          playRelease(release);
        }, onError);
      }, onError);
    } else if (playlistType == 'wantlist') {
      // no video queue, get random release from wantlist and play
      service.getRandomReleaseFromWantlist(identity.username, function(data) {
        service.getRelease(data.id, function(release) {
          playRelease(release);
        }, onError);
      }, onError);
    } else if (playlistType == 'list') {
      // no video queue, get random release from current folder and play
      service.getRandomReleaseFromList(list.id, function(data) {
        console.log(data);
        service.getRelease(data.id, function(release) {
          console.log(release);
          playRelease(release);
        }, onError);
      }, onError);
    }
  };

  var playRelease = function(release) {
    // when there are no videos, go to the next one
    if (typeof release.videos === 'undefined' || release.videos.length == 0) {
      playNext();
    }

    // console.log(release);

    // update the meta information
    videos = release.videos;
    playlist = videos.slice();

    var artist = '';
    for (key in release.artists) {
      artist += (artist.length != 0 ? ', ' : '') + release.artists[key].name;
    }

    var fullTitle = artist + ' - ' + release.title;

    var format = '';
    for (key in release.formats) {
      format += (format.length != 0 ? ', ' : '') + release.formats[key].name;

      if (release.formats[key].descriptions.length != 0) {
        var descriptions = '';
        for (subkey in release.formats[key].descriptions) {
          descriptions += (descriptions.length != 0 ? ', ' : '') + release.formats[key].descriptions[subkey];
        }

        format += ' (' + descriptions + ')';
      }
    }
    if (format == '') {
      format = '<i>&lt;no format provided&gt;</i>';
    }

    var label = '';
    for (key in release.labels) {
      label += (label.length != 0 ? ', ' : '') + release.labels[key].name;
    }
    if (label == '') {
      label = '<i>&lt;no label provided&gt;</i>';
    }

    var fullGenre = '';

    var genre = '';
    for (key in release.genres) {
      genre += (genre.length != 0 ? ', ' : '') + release.genres[key];
    }
    if (genre == '') {
      genre = '<i>&lt;no genre provided&gt;</i>';
    } else {
      fullGenre = genre;
    }

    var style = '';
    for (key in release.styles) {
      style += (style.length != 0 ? ', ' : '') + release.styles[key];
    }
    if (style == '') {
      style = '<i>&lt;no style provided&gt;</i>';
    } else {
      fullGenre += ' (' + style + ')';
    }

    var country = release.country;
    if (!country) {
      country = '<i>&lt;no country provided&gt;</i>';
    }

    var year = release.year;
    if (!year) {
      var year = release.released;
      if (!year) {
        year = '<i>&lt;no year provided&gt;</i>';
      }
    }

    var priceUrl = 'https://www.discogs.com/sell/release/' + release.id + '?ev=rb';
    var price = release.lowest_price;
    if (!price) {
        price = false;
    }

    var rating = '';
    if (typeof release.community.rating.average !== 'undefined') {
      var ratingCount = release.community.rating.count;
      var ratingValue = Math.round((release.community.rating.average * 20) / 10);

      var fullStars = Math.floor(ratingValue / 2);
      var halfStars = Math.ceil(ratingValue % 2);
      var remainingStars = 5 - fullStars - halfStars;

      for (var i = 1; i <= fullStars; i++) {
        rating += '<span class="fa fa-star"></span>';
      }

      if (halfStars) {
        rating += '<span class="fa fa-star-half-o"></span>';
      }

      for (var i = 1; i <= remainingStars; i++) {
        rating += '<span class="fa fa-star-o"></span>';
      }

      rating += '<br><small>';
      if (ratingCount == 1) {
        rating += ' (1 vote)';
      } else {
        rating += ' (' + ratingCount + ' votes)';
      }
      rating += '</small>';
    }

    var videoList = $('<ul class="list-unstyled mb-0">');
    for (key in videos) {
      videoList.append('<li><a href="#" class="play-video" title="Play this video">' + videos[key].title + '</a></li>');
    }

    $('.release-artist').html(artist);
    $('.release-country').html(country);
    $('.release-format').html(format);
    $('.release-full-genre').html(fullGenre);
    $('.release-full-title').html(fullTitle);
    $('.release-genre').html(genre);
    $('.release-href').attr('href', release.uri);
    $('.release-image').attr('src', release.thumb);
    $('.release-label').html(label);
    $('.release-rating').html(rating);
    $('.release-style').html(style);
    $('.release-title').html(release.title);
    $('.release-videos').html(videoList);
    $('.release-year').html(year);

    if (price) {
        $('.release-market-price').html(price.toFixed(2));
        $('.release-market').attr('href', priceUrl).show();
    } else {
        $('.release-market').hide();
    }

    document.title = fullTitle + ' | DiSCYeR';

    resizePlayer();

    // play first video from this release
    playNext();
  };

  var playVideo = function(video) {
    // extract the video id from the uri
    var videoId = getYoutubeIdFromUrl(video.uri);
    if (!videoId) {
      // no videoId extracted, skip to the next video
      playNext();
    }

    if (player) {
      // already initialized a player, just load the video
      player.loadVideoById({
        'videoId': videoId,
        'suggestedQuality': 'large'
      });
    } else {
      // first video, initialize the player
      player = new YT.Player('player', {
        height: '390',
        width: '640',
        videoId: videoId,
        events: {
          'onError': onPlayerError,
          'onReady': onPlayerReady,
          'onStateChange': onPlayerStateChange
        }
      });
    }

    // select the current video
    $('.release-videos li a').each(function() {
      var $this = $(this);

      if ($this.text() == video.title) {
        $this.css('font-weight', 'bold');
      } else {
        $this.css('font-weight', 'normal');
      }
    });
  };

  var onPlayerError = function(event) {
    // an error with the current video, skip to the next one
    playNext();
  };

  var onPlayerReady = function(event) {
    // the video is loaded, autoplay
    resizePlayer();
    console.log('player ready');

    setLoading(false);

    event.target.playVideo();
  };

  var onPlayerStateChange = function(event) {
    setLoading(false);

    // the current video is finished, go to the next one
    if (event.data === 0) {
      playNext();
    }
  };

  var resizePlayer = function() {
    var padding = 5;
    $navbar.each(function() {
      // 16 from css padding
      padding += $(this).height() + 16;
    });

    if ($navbarCollapse.hasClass('show')) {
      padding += $navbarCollapse.height();
    }

    $videoWrapper.css('padding-bottom', $window.height() - padding);
  };

  var getYoutubeIdFromUrl = function(url) {
    // https://stackoverflow.com/questions/3452546/how-do-i-get-the-youtube-video-id-from-a-url
    var regExp = /^.*(youtu\.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    var match = url.match(regExp);
    if (match && match[2].length == 11) {
      return match[2];
    }

    return null;
  };

  var onError = function(data) {
    console.log(data.statusCode());
    if (data.statusCode == 429) {
      alert('Easy on the clicking, you are spamming the Discogs API and they don\'t like it. Just wait a bit ...');

      return;
    }

    alert('Well, it seems like an annoying error occurerd (again)...');
    console.log(data);
  };

  var setLoading = function(isLoading, $element) {
    if ($element === undefined) {
      $element = $('body');
    }

    if (isLoading) {
      $element.addClass('is-loading');
      $element.find('.btn').prop('disabled', true).addClass('disabled');
    } else {
      $element.removeClass('is-loading');
      $element.find('.btn').prop('disabled', false).removeClass('disabled');
    }
  };

  var hasLocalStorage = function() {
    if (_hasLocalStorage !== undefined) {
        return _hasLocalStorage;
    }

	try {
      var x = "--local storage test--"
      localStorage.setItem(x, x);
      localStorage.removeItem(x);

      _hasLocalStorage = true;
	} catch(e) {
      _hasLocalStorage = false;
	}

    return _hasLocalStorage;
  };

  var getFromLocalStorage = function(key, defaultValue) {
    if (!hasLocalStorage()) {
      return defaultValue;
    }

    var value = localStorage.getItem(key);
    if (value === null) {
      value = defaultValue;
    }

    return value;
  };

  var setToLocalStorage = function(key, value) {
    if (!hasLocalStorage()) {
      return false;
    }

    localStorage.setItem(key, value);

    return true;
  };   

  return {
    initialize: _initialize
  };
})(jQuery);

// Run the initializer
$(document).ready(function() {
  discyerApp.initialize();
});
