var $messages = $('.messages-content'),
    d,
    h,
    m,
    i = 0;

$(window).load(function () {
    //$messages.mCustomScrollbar();
    // setTimeout(function () {
    //     fakeMessage();
    // }, 100);
});

function smoothScrollToEnd(element) {
    const totalHeight = element.scrollHeight - element.clientHeight;
    const duration = 200; // Duration of the animation in milliseconds
    const startTime = performance.now();

    function scroll() {
        const elapsedTime = performance.now() - startTime;
        const progress = Math.min(elapsedTime / duration, 1);
        element.scrollTop = progress * totalHeight;

        if (progress < 1) {
            requestAnimationFrame(scroll);
        }
    }

    requestAnimationFrame(scroll);
}

function updateScrollbar(smooth = true) {
    // $messages.mCustomScrollbar('update').mCustomScrollbar('scrollTo', 'bottom', {
    //     scrollInertia: 10,
    //     timeout: 0,
    // });

    const lastMessage = $('<div style="clear:both;margin-top:70px;"></div>').appendTo($('.messages-content'))[0];
    if (lastMessage) {
        lastMessage.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
        setTimeout(() => {
            lastMessage.remove();
        }, 100);
    }
}

function setDate() {
    d = new Date();
    if (m != d.getMinutes()) {
        m = d.getMinutes();
        $('<div class="timestamp">' + d.getHours() + ':' + m + '</div>').appendTo($('.message:last'));
    }
}

function addUserMessage(message) {
    message = message.replace(/(?:\r\n|\r|\n)/g, '<br>');
    return $('<div class="message message-personal">' + message + '</div>').appendTo($('.messages-content'));
}

function addBotMessage(message) {
    message = message.replace(/(?:\r\n|\r|\n)/g, '<br>');
    return $('<div class="message"><figure class="avatar"><img src="./img/sentinel.png" /></figure>' + message + '</div>').appendTo(
        $('.messages-content')
    );
}
function insertMessage() {
    const msg = $('.message-input').val();
    if ($.trim(msg) == '') {
        return false;
    }
    addUserMessage(msg).addClass('new');
    setDate();
    $('.message-input').val(null);
    updateScrollbar(false);
    // setTimeout(function () {
    //     fakeMessage();
    // }, 1000 + Math.random() * 20 * 100);
    sendChat(msg);
}

$('.message-submit').click(function () {
    insertMessage();
});

$(window).on('keydown', function (e) {
    if (e.which == 13 && e.ctrlKey) {
        insertMessage();
        return false;
    }
});

function prepare() {
    //read openapi query param of current page
    const urlParams = new URLSearchParams(window.location.search);
    const specUrl = urlParams.get('openapi');

    if (!specUrl) {
        console.error('Missing openapi query parameter');
        alert('Missing openapi query parameter');
        return;
    }

    $('.btn-refresh').attr('href', '/refresh?openapi=' + specUrl);

    fetch('/api/info?specUrl=' + specUrl)
        .then((response) => response.json())
        .then((data) => {
            console.log('Data:', data);
            document.querySelector('.chat-title h1').textContent = data.name;

            if (!data?.messages?.length) {
                fetchAndProcessData('Say Hi and present yourself briefly in less than 50 words');
            } else {
                for (let message of data.messages) {
                    $('.bottom').remove();
                    if (!message?.role) continue;
                    if (message.role === 'user' && typeof message.content === 'string') {
                        addUserMessage(message.content).addClass('new');
                    } else {
                        if (typeof message.content === 'string') {
                            addBotMessage(message.content);
                        } else {
                            if (Array.isArray(message.content)) {
                                let html = '';
                                for (let c of message.content) {
                                    if (!c) continue;
                                    if (c.type === 'text') {
                                        html += c.text;
                                    }
                                    if (c.type === 'tool_use') {
                                        html += `<div class="toolMsg done" id="${c.id}">Called ${c.name} <br /><span class="args">${JSON.stringify(
                                            c.input
                                        )}</span></div>`;
                                    }
                                }
                                if (html) {
                                    addBotMessage(html);
                                }
                            }
                        }
                    }

                    updateScrollbar(false);
                }
            }
        })
        .catch((error) => {
            console.error('Error:', error);
        });
}

function sendChat(message) {
    //fetch stream chat from server
    fetchAndProcessData(message);
}

// Define the function to fetch and process data progressively
async function fetchAndProcessData(message) {
    //make the input area readonly
    $('.message-input').attr('readonly', 'readonly');
    //disable send button
    $('.message-submit').attr('disabled', 'disabled');

    $('<div class="message loading new"><figure class="avatar"><img src="./img/sentinel.png" /></figure><span></span></div>').appendTo(
        $('.messages-content')
    );

    updateScrollbar();
    try {
        const specUrl = new URLSearchParams(window.location.search).get('openapi');
        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ message, specUrl }),
        });

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');

        let result = '';

        // Read the stream
        while (true) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            // Convert the Uint8Array to string and process it
            result += decoder.decode(value, { stream: true });
            //console.log('Received chunk:', result);
            // Optionally, you can process data as it comes
            processChunk(result);
            result = ''; // clear the result if you're processing chunk-wise
        }

        updateScrollbar();
        let currentChatbox = document.querySelector('.chatbox.current');
        if (currentChatbox) {
            currentChatbox.classList.remove('current');
        }

        let newMessage = document.querySelector('.message.new');
        if (newMessage) {
            newMessage.classList.remove('new');
        }
        // Finalize decoding any remaining part of the input
        //console.log('Final output:', decoder.decode());

        //make the input area readonly
        $('.message-input').removeAttr('readonly');
        //disable send button
        $('.message-submit').removeAttr('disabled');
    } catch (error) {
        console.error('Failed to fetch:', error);

        //make the input area readonly
        $('.message-input').removeAttr('readonly');
        //disable send button
        $('.message-submit').removeAttr('disabled');

        if (document.querySelector('.message.loading')) {
            $('.message.loading').remove();
        }
    }
}

// Example processing function
function processChunk(chunk) {
    if (document.querySelector('.message.loading')) {
        $('.message.loading').remove();
    }

    let currentChatbox = document.querySelector('.chatbox.current');

    if (!currentChatbox) {
        $('.bottom').remove();
        $(
            '<div class="message new"><figure class="avatar"><img src="./img/sentinel.png" /></figure>' +
                '<span class="chatbox current"></span>' +
                '</div>'
        )
            .appendTo($('.messages-content'))
            .addClass('new');
        setDate();
        updateScrollbar();
    }

    currentChatbox = document.querySelector('.chatbox.current');

    //a chunk is one or successive json strings that are separated by spaces
    //split and parse the js parts
    let parts = chunk.split(/}\s*{/gm).map((e) => {
        if (!e.startsWith('{')) e = '{' + e;
        if (!e.endsWith('}')) e += '}';

        try {
            return JSON.parse(e);
        } catch (error) {
            console.error('Failed to parse:', e);
            return {};
        }
    });

    for (let part of parts) {
        if (part.content) {
            const html = part.content.replace(/(?:\r\n|\r|\n)/g, '<br>');

            currentChatbox.innerHTML += html;
        }
        if (part.tool) {
            console.log('Tool:', part.tool);
            if (!part.result) {
                currentChatbox.innerHTML += `<div class="toolMsg calling" id="${part.tool.id}"><div class="message loading"></div>Calling ${
                    part.tool.name
                } <br /><span class="args">${JSON.stringify(part.tool.arguments)}</span></div>`;
            } else {
                let toolMsg = document.getElementById(part.tool.id);
                if (toolMsg) {
                    toolMsg.classList.remove('calling');
                    toolMsg.classList.add('done');
                    //toolMsg.querySelector('.message.loading').remove();
                    toolMsg.innerHTML = `Called ${part.tool.name} <br /><span class="args">${JSON.stringify(part.tool.arguments)}</span>`;
                }
            }
        }
    }
    //currentChatbox.innerHTML += chunk;

    updateScrollbar();
}

setTimeout(prepare, 500);
