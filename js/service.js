(function(context, undefined) {

  var serviceUrl = 'https://api.discogs.com';

  var token = null;

  var numReleasesInWantlist = null;

  var lists = [];

  var errorHandler = undefined;

  var setServiceUrl = function(url) {
    serviceUrl = url;
  };

  var getServiceUrl = function() {
    return serviceUrl;
  };

  var setAccessToken = function(accessToken) {
    token = accessToken;
  };

  var getAccessToken = function() {
    return token;
  };

  var clearCache = function() {
    numReleasesInWantlist = null;
    lists = [];
  };

  var performRequest = function(method, path, successHandler, errorHandler, data) {
    var request = {
      type: method,
      dataType: 'json',
      crossDomain: true,
      url: serviceUrl + path,
      beforeSend: function(request) {
        request.setRequestHeader('Authorization', 'Discogs token=' + token);
        request.setRequestHeader('User-Agent', 'DiSCYeR/0.1');
      },
      success: function(data, status, jqXHR) {
        if (successHandler != undefined) {
          successHandler(data, jqXHR);
        }
      },
      error: function(jqXHR, status, errorThrown) {
        if (errorHandler != undefined) {
          errorHandler(jqXHR);
        } else {
          alert('Could not complete action: ' + errorThrown);
          console.log(jqXHR);
        }
      }
    };

    $.ajax(request);
  };

  var getIdentity = function(successHandler, errorHandler) {
    performRequest('GET', '/oauth/identity', successHandler, errorHandler);
  };

  var getProfile = function(username, successHandler, errorHandler) {
      performRequest('GET', '/users/' + username, successHandler, errorHandler);
  }

  var getFolders = function(username, successHandler, errorHandler) {
    performRequest('GET', '/users/' + username + '/collection/folders', successHandler, errorHandler);
  };

  var getLists = function(username, successHandler, errorHandler) {
    performRequest('GET', '/users/' + username + '/lists', successHandler, errorHandler);
  };

  var getRandomReleaseFromFolder = function(username, folderId, numReleasesInFolder, successHandler, errorHandler) {
    var releaseIndex = Math.floor((Math.random() * numReleasesInFolder) + 1);

    performRequest('GET', '/users/' + username + '/collection/folders/' + folderId + '/releases?page=' + releaseIndex + '&per_page=1', function(data) {
      successHandler(data.releases[0]);
    }, errorHandler);
  };

  var getRandomReleaseFromWantlist = function(username, successHandler, errorHandler) {
    if (numReleasesInWantlist === null) {
      performRequest('GET', '/users/' + username + '/wants?page=1&per_page=1', function(data) {
        numReleasesInWantlist = data.pagination.items;

        getRandomReleaseFromWantlist(username, successHandler, errorHandler);
      }, errorHandler);
    } else {
      var releaseIndex = Math.floor((Math.random() * numReleasesInWantlist) + 1);

      performRequest('GET', '/users/' + username + '/wants?page=' + releaseIndex + '&per_page=1', function(data) {
        successHandler(data.wants[0]);
      }, errorHandler);
    }
  };

  var getRandomReleaseFromList = function(listId, successHandler, errorHandler, threshold) {
    if (typeof threshold === 'undefined') {
        threshold = 5;
    }

    if (typeof lists[listId] === 'undefined') {
      performRequest('GET', '/lists/' + listId, function(data) {
        lists[listId] = data;

        getRandomReleaseFromList(listId, successHandler, errorHandler);
      }, errorHandler);
    } else {
      var releaseIndex = Math.floor((Math.random() * lists[listId].items.length) + 1);

      if (typeof lists[listId].items[releaseIndex] === 'undefined') {
        if (threshold > 0) {
          getRandomReleaseFromList(listId, successHandler, errorHandler, threshold--);
        } else {
          errorHandler({'error': 'Reached request threshold'});
        }
      } else {
        successHandler(lists[listId].items[releaseIndex]);
      }
    }
  };

  var getRelease = function(releaseId, successHandler, errorHandler) {
    performRequest('GET', '/releases/' + releaseId, successHandler, errorHandler);
  };

  return context.discyerService = {
    setServiceUrl: setServiceUrl,
    getServiceUrl: getServiceUrl,
    setAccessToken: setAccessToken,
    getAccessToken: getAccessToken,
    clearCache: clearCache,
    getIdentity: getIdentity,
    getProfile: getProfile,
    getFolders: getFolders,
    getLists: getLists,
    getRandomReleaseFromFolder: getRandomReleaseFromFolder,
    getRandomReleaseFromWantlist: getRandomReleaseFromWantlist,
    getRandomReleaseFromList: getRandomReleaseFromList,
    getRelease: getRelease
  };

})(window);
