var dt = {
    controlsVideo: document.getElementById("video"),
    controlsVideoBackGround: document.getElementById("backgrounVideo"),
    contPosBloco: 0,
    arraySequence: new Array(),
    tempo: null,
    lengthDP: null,
    videoPlay: false,
    play_pause: 0,
    last_block_erro: false,
};
var dataPlayer = null, validDataPlayer = null, tvCode = null, alertOpen = false, randomReproductionomica = false, listIdsBlocoRepeat = {}, listaDeConteudosReproduzidos = new Array();

function checkDataPlayer(verify = false){
    BACKEND.Send('GetDataPlayer').then((data) => {
        if(data != "no_data"){
            if(verify === true && dataPlayer != null){
                dataPlayer = data.map((item) => {
                    if(!item.oldData) item.oldData = new Array();
                    let actul_item = dataPlayer.find(f => f.id_item_complet === item.id_item_complet);
                    if(actul_item){
                        item.oldData = item.data.map(eItem => {
                            if(actul_item.oldData){
                                if(actul_item.oldData.find(ee => ee.diretorio === eItem.diretorio)) return eItem;
                            }
                            return null;
                        }).filter(f => f != null);
                        
                        item.data = item.data.map(eItem => {
                            if(item.oldData.find(ee => ee.diretorio === eItem.diretorio)) return null;
                            return eItem;
                        }).filter(f => f != null);
                    }
                    return item;
                });
            }
            else{
                dataPlayer = data;
                $(".card").addClass('hidden');
                $(".aviso-tv").addClass('hidden');
                validDataPlayer = null;
                for (let index = 0; index < dataPlayer.length; index++) {
                    dataPlayer[index]["oldData"] = new Array();
                }
            }            
        }else{
            validDataPlayer = data;
        }
    });
}

$(document).ready(function () {
    dt.controlsVideo.controls = false;
    checkDataPlayer();
    setInterval(()=>{
        getUpdate();
    }, 500);

    setInterval(()=>{
        checkDataPlayer(true);
    }, 5000)
});

function getTempo(tempo){
    let minuto = tempo.split(":")[0];
    let segundos = tempo.split(":")[1];
    let newSegundos = minuto*60;
    let newTempo = newSegundos*1000 + segundos*1000;
    return newTempo;
}

async function player() {
    if(dt.play_pause == 1){
        var item = dataPlayer[dt.contPosBloco], tempoRespoducao;
        if(item.ismultitempo == false)
            tempoRespoducao = await getTempo(item.tempo);

        if(item.data.length == undefined){
            if(item.data.diretorio != null){
                check_file_existe(item.data.diretorio, (is_exist)=>{
                    if(is_exist){
                        try {
                            saveNowIdBlockReproduct(item.data.blocoId, item.data.type);   
                        } catch (error) { }
                        
                        if(item.data.type != "VIDEO"){
                            $(".img").attr("src", "");
                            $('.reprodutor-html').remove();
                            $('.div-reprodutor-html').html('<object type="text/html" data="" class="reprodutor-html hidden"></object>');
                            let typeFile = item.data.diretorio.split('.').pop();
                            if(typeFile === "html" || item.data.type === "INSTAGRAM" || item.data.type === "RSS"){
                                $(".previw-video").addClass("hidden");
                                $(".previw-img").addClass("hidden");
                                $('.reprodutor-html').attr('data', `${item.data.diretorio}`);
                                $('.reprodutor-html').removeClass('hidden');
                            }
                            else{
                                $(".previw-video").addClass("hidden");
                                $(".img").attr("src", item.data.diretorio);
                                $(".previw-img").removeClass("hidden");
                            }
                        }else{
                            dt.controlsVideo.src = item.data.diretorio;
                            dt.controlsVideoBackGround.src = item.data.diretorio;
                            dt.controlsVideo.play();
                            dt.controlsVideoBackGround.play();
                            dt.videoPlay = true;
                            dt.controlsVideo.onloadeddata = ()=>{
                                $(".previw-img").addClass("hidden");
                                $(".previw-video").removeClass("hidden");
                                $(".img").attr("src", "");
                                $('.reprodutor-html').remove();
                                $('.div-reprodutor-html').html('<object type="text/html" data="" class="reprodutor-html hidden"></object>');
                                set_timeout();
                            }
                        }
                        let splitDir = item.data.diretorio.split('/');
                        listaDeConteudosReproduzidos.push(
                            {
                                bloco_id: item.blocoId,
                                tag: item.name_Tag,
                                random_itens: item.random_itens,
                                data_reproducao: new Date().toLocaleString(),
                                data_arquivo: item.data,
                                nome_pasta: splitDir[splitDir.length-2],
                                nome_arquivo: splitDir[splitDir.length-1],
                            }
                        );

                        if(item.data.type != "VIDEO"){
                            set_timeout();
                        }
                    }
                    else{
                        tempoRespoducao = 0;
                        set_timeout();
                    }
                });
            }
            else{
                tempoRespoducao = 0;
                set_timeout();
            }
        }
        else{
            if(dataPlayer[dt.contPosBloco].random_itens != true && dataPlayer[dt.contPosBloco].random_itens != "TRUE"){
                if(item.data.length < 1 && item.oldData.length > 0){
                    dataPlayer.forEach(element => {
                        if(element.data.length <= 1){
                            if(element.noArray != true){
                                element.data = element.oldData;
                                element.oldData = new Array();
                            }
                        }
                    });
                }
                var posNow = parseInt(item.pos);
                if(listIdsBlocoRepeat[item.blocoId] != undefined){
                    posNow = listIdsBlocoRepeat[item.blocoId].pos;
                    if(posNow > (item.data.length-1)){
                        listIdsBlocoRepeat[item.blocoId] = { pos: 0, id: item.blocoId };
                        posNow = 0;
                    }
                }
                var dto = item.data[posNow];
                if(dto != null){
                    check_file_existe(dto.diretorio, (is_exist)=>{
                        if(is_exist){
                            try {
                                saveNowIdBlockReproduct(dto.blocoId, dto.type);   
                            } catch (error) {  }
                            
                            if(dto.type != "VIDEO"){
                                $(".img").attr("src", "");
                                $('.reprodutor-html').remove();
                                $('.div-reprodutor-html').html('<object type="text/html" data="" class="reprodutor-html hidden"></object>');
                                let typeFile = dto.diretorio.split('.').pop();
                                if(typeFile === "html" || dto.type == "INSTAGRAM" || dto.type == "RSS"){
                                    $(".previw-video").addClass("hidden");
                                    $(".previw-img").addClass("hidden");
                                    $('.reprodutor-html').attr('data', `${dto.diretorio}`);
                                    $('.reprodutor-html').removeClass('hidden');
                                }
                                else{
                                    $(".previw-video").addClass("hidden");
                                    $(".img").attr("src", dto.diretorio);
                                    $(".previw-img").removeClass("hidden");
                                }
                                if(item.ismultitempo == true){
                                    if(dto.type == "IMG"){
                                        tempoRespoducao = getTempo(item.tempo_img);
                                    }
                                    else if(dto.type == "RSS"){
                                        tempoRespoducao = getTempo(item.tempo_rss);
                                    }
                                    else if(dto.type == "INSTAGRAM"){
                                        tempoRespoducao = getTempo(item.tempo_instagram);
                                    }
                                }
                            }else{
                                if(item.ismultitempo == true){
                                    if(getTempo(item.tempo_video) < 1)
                                        tempoRespoducao = getTempo(formatDurationTimeVideo(dto.duration));
                                    else
                                        tempoRespoducao = getTempo(item.tempo_video);
                                }
                                
                                dt.controlsVideo.src = dto.diretorio;
                                dt.controlsVideoBackGround.src = dto.diretorio;
                                dt.controlsVideo.play();
                                dt.controlsVideoBackGround.play();
                                dt.videoPlay = true;
                                dt.controlsVideo.onloadeddata = ()=>{
                                    $(".previw-img").addClass("hidden");
                                    $(".previw-video").removeClass("hidden");
                                    $(".img").attr("src", "");
                                    $('.reprodutor-html').remove();
                                    $('.div-reprodutor-html').html('<object type="text/html" data="" class="reprodutor-html hidden"></object>');
                                    set_timeout();
                                }
                            }
                            
                            let splitDir = dto.diretorio.split('/')
                            listaDeConteudosReproduzidos.push(
                                {
                                    bloco_id: item.blocoId,
                                    tag: item.name_Tag,
                                    random_itens: item.random_itens,
                                    data_reproducao: new Date().toLocaleString(),
                                    data_arquivo: dto,
                                    nome_pasta: splitDir[splitDir.length-2],
                                    nome_arquivo: splitDir[splitDir.length-1],
                                }
                            );
                            if(posNow < (item.data.length-1)){
                                listIdsBlocoRepeat[item.blocoId] = { pos: posNow+1, id: item.blocoId };
                                dataPlayer[dt.contPosBloco].pos = posNow+1;
                            }else{
                                listIdsBlocoRepeat[item.blocoId] = { pos: 0, id: item.blocoId };
                                dataPlayer[dt.contPosBloco].pos = 0;
                            }

                            dataPlayer.forEach(element => {
                                if(element.name_Tag == item.name_Tag){
                                    if(element.data.length >= 1){
                                        if(element.noArray != true){
                                            element.oldData.push(element.data[posNow]);
                                            element.data = element.data.filter(f => f.diretorio != dto.diretorio);
                                            element.data = shuffleArray(element.data);
                                        }
                                    }
                                    else{
                                        if(element.noArray != true){
                                            element.data = element.oldData;
                                            element.oldData = new Array();
                                        }
                                    }
                                }
                            });

                            if(dto.type != "VIDEO"){
                                set_timeout();
                            }
                        }
                        else{
                            try {
                                let splitDir = dto.diretorio.split('/')
                                listaDeConteudosReproduzidos.push(
                                    {
                                        bloco_id: item.blocoId,
                                        tag: item.name_Tag,
                                        random_itens: item.random_itens,
                                        data_reproducao: new Date().toLocaleString(),
                                        data_arquivo: dto,
                                        nome_pasta: splitDir[splitDir.length-2],
                                        nome_arquivo: splitDir[splitDir.length-1],
                                    }
                                );
                                if(posNow < (item.data.length-1)){
                                    listIdsBlocoRepeat[item.blocoId] = { pos: posNow+1, id: item.blocoId };
                                    dataPlayer[dt.contPosBloco].pos = posNow+1;
                                }else{
                                    listIdsBlocoRepeat[item.blocoId] = { pos: 0, id: item.blocoId };
                                    dataPlayer[dt.contPosBloco].pos = 0;
                                }
                            } catch (error) { }
                            tempoRespoducao = 0;
                            try {
                                dataPlayer.forEach(element => {
                                    if(element.name_Tag == item.name_Tag){
                                        if(element.data.length >= 1){
                                            if(element.noArray != true){
                                                element.oldData.push(element.data[posNow]);
                                                element.data = element.data.filter(f => f.diretorio != dto.diretorio);
                                                element.data = shuffleArray(element.data);
                                            }
                                        }
                                        else{
                                            if(element.noArray != true){
                                                element.data = element.oldData;
                                                element.oldData = new Array();
                                            }
                                        }
                                    }
                                });   
                            } catch (error) {
                                console.log(error);
                            }
                            set_timeout();
                        }
                    });
                }
                else{
                    tempoRespoducao = 0;
                    set_timeout();
                }
            }else{
                if(item.data.length < 1){
                    dataPlayer.forEach(element => {
                        if(element.name_Tag == item.name_Tag){
                            if(element.data.length <= 1){
                                if(element.noArray != true){
                                    element.data = element.oldData;
                                    element.oldData = new Array();
                                }
                            }
                        }
                    });
                }
                item = dataPlayer[dt.contPosBloco];
                var dto = item.data[0];
                if(dto != null){
                    check_file_existe(dto.diretorio, (is_exist)=>{
                        if(is_exist){
                            try {
                                saveNowIdBlockReproduct(dto.blocoId, dto.type);   
                            } catch (error) { }

                            if(dto.type != "VIDEO"){
                                $(".img").attr("src", "");
                                $('.reprodutor-html').remove();
                                $('.div-reprodutor-html').html('<object type="text/html" data="" class="reprodutor-html hidden"></object>');
                                let typeFile = dto.diretorio.split('.').pop();
                                if(typeFile === "html" || dto.type === "INSTAGRAM" || dto.type === "RSS"){
                                    $(".previw-video").addClass("hidden");
                                    $(".previw-img").addClass("hidden");
                                    $('.reprodutor-html').attr('data', `${dto.diretorio}`);
                                    $('.reprodutor-html').removeClass('hidden');
                                }
                                else{
                                    $(".previw-video").addClass("hidden");
                                    $(".img").attr("src", dto.diretorio);
                                    $(".previw-img").removeClass("hidden");
                                }

                                if(item.ismultitempo == true){
                                    if(dto.type == "IMG"){
                                        tempoRespoducao = getTempo(item.tempo_img);
                                    }
                                    else if(dto.type == "RSS"){
                                        tempoRespoducao = getTempo(item.tempo_rss);
                                    }
                                    else if(dto.type == "INSTAGRAM"){
                                        tempoRespoducao = getTempo(item.tempo_instagram);
                                    }
                                }
                            }
                            else{
                                if(item.ismultitempo == true){
                                    if(getTempo(item.tempo_video) < 1)
                                        tempoRespoducao = getTempo(formatDurationTimeVideo(dto.duration));
                                    else
                                        tempoRespoducao = getTempo(item.tempo_video);
                                }
                                dt.controlsVideo.src = dto.diretorio;
                                dt.controlsVideoBackGround.src = dto.diretorio;
                                dt.controlsVideo.play();
                                dt.controlsVideoBackGround.play();
                                dt.videoPlay = true;
                                dt.controlsVideo.onloadeddata = ()=>{
                                    $(".previw-img").addClass("hidden");
                                    $(".previw-video").removeClass("hidden");
                                    $(".img").attr("src", "");
                                    $('.reprodutor-html').remove();
                                    $('.div-reprodutor-html').html('<object type="text/html" data="" class="reprodutor-html hidden"></object>');
                                    set_timeout();
                                }
                            }
                        
                            let splitDir = dto.diretorio.split('/');
                            listaDeConteudosReproduzidos.push(
                                {
                                    bloco_id: item.blocoId,
                                    tag: item.name_Tag,
                                    random_itens: item.random_itens,
                                    data_reproducao: new Date().toLocaleString(),
                                    data_arquivo: dto,
                                    nome_pasta: splitDir[splitDir.length-2],
                                    nome_arquivo: splitDir[splitDir.length-1],
                                }
                            );
                        
                            dataPlayer.forEach(element => {
                                if(element.name_Tag == item.name_Tag){
                                    if(element.data.length >= 1){
                                        if(element.noArray != true){
                                            element.oldData.push(element.data[0]);
                                            element.data.shift();
                                            element.data = shuffleArray(element.data);
                                        }
                                    }
                                    else{
                                        if(element.noArray != true){
                                            element.data = element.oldData;
                                            element.oldData = new Array();
                                        }
                                    }
                                }
                            });

                            if(dto.type != "VIDEO"){
                                set_timeout();
                            }
                        }
                        else{
                            let splitDir = dto.diretorio.split('/');
                            listaDeConteudosReproduzidos.push(
                                {
                                    bloco_id: item.blocoId,
                                    tag: item.name_Tag,
                                    random_itens: item.random_itens,
                                    data_reproducao: new Date().toLocaleString(),
                                    data_arquivo: dto,
                                    nome_pasta: splitDir[splitDir.length-2],
                                    nome_arquivo: splitDir[splitDir.length-1],
                                }
                            );
                        
                            dataPlayer.forEach(element => {
                                if(element.name_Tag == item.name_Tag){
                                    if(element.data.length >= 1){
                                        if(element.noArray != true){
                                            element.oldData.push(element.data[0]);
                                            element.data.shift();
                                            element.data = shuffleArray(element.data);
                                        }
                                    }
                                    else{
                                        if(element.noArray != true){
                                            element.data = element.oldData;
                                            element.oldData = new Array();
                                        }
                                    }
                                }
                            });
                            tempoRespoducao = 0;
                            set_timeout();
                        }
                    });
                }
                else{
                    tempoRespoducao = 0;
                    set_timeout();
                }
            }
        }

        function set_timeout(){
            setTimeout(()=>{
                dt.contPosBloco = dt.contPosBloco+1;
                dt.controlsVideo.pause();
                dt.controlsVideoBackGround.pause();
                dt.controlsVideo.src = "";
                dt.controlsVideoBackGround.src = "";
                if(dt.contPosBloco <= (dataPlayer.length-1))
                    player();
                else{
                    if(randomReproductionomica == true){
                        dt.contPosBloco = 0;
                        dataPlayer = shuffleArray(dataPlayer);
                        player();
                    }else{
                        createLogReproducao(listaDeConteudosReproduzidos);
                        dt.contPosBloco = 0;
                        listaDeConteudosReproduzidos = new Array();
                        player();
                    }
                }
            }, tempoRespoducao)
        }
    }else{
        dt.play_pause = 0;
    }  
}

function validPlayer(r) {
    if(validDataPlayer != "no_data"){
        $(".card").addClass('hidden');
        $(".aviso-tv").addClass('hidden');
        if(r.playerState == 'PLAY'){
            if(dt.play_pause == 0){
                $(".state-player").addClass("hidden");
                dt.play_pause = 1;
                player();
            }
        }else{
            $(".state-player").removeClass("hidden");
            dt.play_pause = 0;
        }
    }else{
        $(".card").removeClass('hidden');
        $(".aviso-tv").removeClass('hidden');
        $(".aviso-tv").text(`Não há conteúdo para reprodução por favor publique uma Time Line!`)
    }
}

function reloadScreen(r){
    if(r === true){
        checkDataPlayer();
        //location.reload();
    }else{
    }
}

function downloadRuning(data){
    if(data.porcentagemDOwnlaod != null){
        let text = data.porcentagemDOwnlaod.text ? data.porcentagemDOwnlaod.text : "Time Line Download";
        let porcentagemBlock = parseInt((data.porcentagemDOwnlaod.blocoListaNow*100)/data.porcentagemDOwnlaod.blocoListaMax);
        let porcentagem = parseInt((parseFloat(`${data.porcentagemDOwnlaod.now}.${porcentagemBlock}`)*100)/data.porcentagemDOwnlaod.max);
        if(data.porcentagemDOwnlaod.block && data.nameBLock != ""){
            let DtoDownloadBlock = data.porcentagemDOwnlaod.block;
            //console.log(DtoDownloadBlock);
            $(".top-card").css('display', 'flex').text(`${DtoDownloadBlock.text}: ${DtoDownloadBlock.percent}%`);
        }
        else{
            $(".top-card").css('display', 'flex').text(`${text}: ${porcentagem}%`);
        }
    }else if($(".top-card").text().length > 0){
        $(".top-card").css('display', 'none');
    }
}

function getUpdate(){
    BACKEND.Send('GetUpdate').then((data) => {
        if(data.UpdateDataPlayerNoReload == "true"){
            updateDataPlayerNoReload()
        }
        tvCode = data.tvCode;
        if(data.update == true){
            reloadScreen(true)
        }
        downloadRuning(data);
        validPlayer(data);
        $("#loading").fadeOut('slow');
        $("#pos-loading").fadeIn();
        reloadScreen(data.stateScreen);
        if(data.randomReproduction == "ATIVO")
            randomReproductionomica = true;
        else
            randomReproductionomica = false;
        muteTv(data.infoTv);
        $('#version-app').text(data.version);
        if(data.ststusDependencia != "Dependência já Existente" && data.ststusDependencia != "Download Completo"){
            $('#download-dependences').css('color', '#858585');
            $('#download-dependences').text(data.ststusDependencia);
        }
        else
            $('#download-dependences').text('');

        if(data.porcentagemUpdateAppOwnlaod){
            $('#download-dependences').text(data.porcentagemUpdateAppOwnlaod);
            $('#download-dependences').css('color', 'red');
        }
        else {
            $('#download-dependences').css('color', '#858585');
            $('#download-dependences').text('');
        }
    });
}

function shuffleArray(arr) {
    for (var j, x, i = arr.length; i; j = Math.floor(Math.random() * i), x = arr[--i], arr[i] = arr[j], arr[j] = x);
    return arr;
}

function muteTv(infoTv){
    if(infoTv != null && infoTv != ""){
        let objInfoTv = JSON.parse(infoTv);
        if(objInfoTv.mute == "TRUE")
            dt.controlsVideo.muted  = true;
        else
            dt.controlsVideo.muted  = false;
    }
}

function formatDurationTimeVideo(duration){
    let tem = duration;
    if(tem > 60){
        let str = `${(tem/60)}`.split('.');
        tem = `${str[0]}:${str[1].substring(0,2)}`;
    }else
        tem = `00:${tem}`;

    return tem;
}

function updateDataPlayerNoReload(){
    BACKEND.Send('GetDataPlayer').then((data) => {
        if(data != "no_data"){
            let newData = data;
            for (let index = 0; index < newData.length; index++) {
                newData[index]["oldData"] = new Array();
            }
            if(JSON.stringify(newData) != JSON.stringify(dataPlayer)){
                dataPlayer = newData;
                //console.log('Update Data ok')
            }
        }
    });
}

function createLogReproducao(list){
    BACKEND.Send('CreateLogRepoducaoTv', list);
}

function saveNowIdBlockReproduct(blockId, type = ""){
    if(blockId != null){
        BACKEND.Send('SaveNowBlockReproduct', {blockId: blockId, type: type, data: new Date().toLocaleString()});
    }
}

const check_file_existe = async (url, callback)=>{
    try {
        $.ajax({
            url: url,
            type: 'GET',
            success: function(data){
                callback(true, url);
            },
            error: function(error){
                callback(false, url);
            }
        });
    } catch (error) {
        callback(true, url);
    }
}