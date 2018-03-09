var localVideo;
var localStream;
var remoteVideo;
var peerConnection;
var uuid;
var serverConnection;
var serverUuid;
var clients;
//var SOCKET_ADDRESS = "54.210.26.37"
var SOCKET_ADDRESS = window.location.hostname;
var peerConnectionConfig = {
  'iceServers': [
    {'urls': 'stun:stun.services.mozilla.com'},
    {'urls': 'stun:stun.l.google.com:19302'},
  ]
};

function pageReady() {
  uuid = createUUID();
  clients = [];
  peerConnection = {}
  localVideo = document.getElementById('localVideo');
  remoteVideos = document.getElementById('remoteVideos');

  serverConnection = new WebSocket('wss://' + SOCKET_ADDRESS + ':8444');
  serverConnection.onmessage = gotMessageFromServer;

  var constraints = {
    video: true,
    audio: true,
  };

  if(navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia(constraints).then(getUserMediaSuccess).catch(errorHandler);
  } else {
    alert('Your browser does not support getUserMedia API');
  }
  
}

function getUserMediaSuccess(stream) {
  localStream = stream;
  localVideo.srcObject = stream;
}

function start(isCaller) {
  call();
}

function gotMessageFromServer(message) {
  if(!peerConnection) start(false);

  var signal = JSON.parse(message.data);

  // Ignore messages from ourself
  if(signal.uuid == uuid) return;

  if( signal.call ){
    console.log( "Received call" )
      answer(false);
  }
  if( signal.answer ){
    console.log('Received answer');
      serverUuid = signal.uuid;
      newPeer = new RTCPeerConnection(peerConnectionConfig);
      newPeer.onicecandidate = gotIceCandidate;
      newPeer.ontrack = gotRemoteStream;
      newPeer.addStream(localStream);
      peerConnection[serverUuid] = newPeer;
      newPeer.createOffer().then(createdDescription).catch(errorHandler);  
  }

  if(signal.sdp) {
    newPeer = peerConnection[signal.uuid];
    newPeer.setRemoteDescription(new RTCSessionDescription(signal.sdp)).then(function() {
      // Only create answers in response to offers
      if(signal.sdp.type == 'offer') {
        newPeer.createAnswer().then(createdDescription).catch(errorHandler);
      }
    }).catch(errorHandler);
  } else if(signal.ice) {
    console.log(signal.uuid)
    console.log(uuid)
    console.log(peerConnection)
    newPeer = peerConnection[signal.uuid];
    newPeer.addIceCandidate(new RTCIceCandidate(signal.ice)).catch(errorHandler);
  }
}

function gotIceCandidate(event) {
  if(event.candidate != null) {
    console.log("Got Ice Candidate");

    serverConnection.send(JSON.stringify({'ice': event.candidate, 'uuid': uuid}));
  }
}

function call() {
  console.log('Calling clients');
  serverConnection.send(JSON.stringify({'myUuid': uuid, 'uuid':uuid, 'call':true}));
}

function answer() {
  console.log('Answering call');
  serverConnection.send(JSON.stringify({'myUuid': uuid, 'uuid':uuid, 'answer':true}));
}

function createdDescription(description, serverUuid) {
  console.log('got description');

  //peer = peerConnection[serverUuid];
  console.log( newPeer )
  //console.log( peerConnection )
  newPeer.setLocalDescription(description).then(function() {
    serverConnection.send(JSON.stringify({'sdp': peerConnection.localDescription, 'uuid': uuid}));
  }).catch(errorHandler);
}

function gotRemoteStream(event) {
  console.log('got remote stream');
  console.log(event);
  remoteVideo = document.createElement("video");
  remoteVideo.srcObject = event.streams[0];
  document.getElementById("remoteVideos").appendChild(remoteVideo);
  
}

function errorHandler(error) {
  console.log(error);
}

// Taken from http://stackoverflow.com/a/105074/515584
// Strictly speaking, it's not a real UUID, but it gets the job done here
function createUUID() {
  function s4() {
    return Math.floor((1 + Math.random()) * 0x10000).toString(16).substring(1);
  }

  return s4() + s4() + '-' + s4() + '-' + s4() + '-' + s4() + '-' + s4() + s4() + s4();
}
