ipcRenderer.on('DataLinkTv', (events, data) => {
    $("#loading").fadeOut('slow');
    $("#pos-loading").fadeIn();
    if($("#text").text() == ""){
        document.querySelector('#qrCode').src = data.qrCodeUrl;
        $("#text").text("Para reproduzir conteúdo vincule a TV pelo QR Code ou usando o código: "+data.tvCode);
    }
    $('#version-app').text(data.version);
    if(data.StatusChromiumDependency != "Dependência já Existente" && data.StatusChromiumDependency != "Download Completo"){
        $('#download-dependences').css('color', '#858585');
        $('#download-dependences').text(data.StatusChromiumDependency);
    }
    else {
        $('#download-dependences').text('');
    }
    if(data.porcentagemUpdateAppOwnlaod){
        $('#download-dependences').text(data.porcentagemUpdateAppOwnlaod);
        $('#download-dependences').css('color', 'red');
    }
    else {
        $('#download-dependences').css('color', '#858585');
        $('#download-dependences').text('');
    }
});

$(document).ready(function () {
    BACKEND.Send('GetDataLinkTv');
});