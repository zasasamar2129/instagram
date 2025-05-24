export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    
    // Webhook verification
    if (request.method === 'GET') {
      if (url.searchParams.get('hub.verify_token') === env.VERIFY_TOKEN) {
        return new Response(url.searchParams.get('hub.challenge'));
      }
      return new Response('Invalid token', { status: 403 });
    }

    // Handle Instagram events
    if (request.method === 'POST') {
      try {
        const body = await request.json();
        const comment = body.entry[0]?.changes[0]?.value;
        
        if (comment && (comment.text === 'song' || comment.text === 'اهنگ')) {
          const userId = comment.from.id;
          const mediaId = comment.media.id;
          
          // Check if user follows
          const follows = await checkFollowStatus(userId, env);
          if (!follows) {
            await sendDM(userId, "Please follow our page first to get the song link!", env);
          } else {
            const songLink = await findTelegramPost(mediaId, env);
            await sendDM(userId, songLink || "Song not found", env);
          }
        }
        return new Response('OK');
      } catch (error) {
        return new Response(error.message, { status: 500 });
      }
    }

    return new Response('Not found', { status: 404 });
  }
};

async function checkFollowStatus(userId, env) {
  const url = `https://graph.facebook.com/v19.0/${userId}?fields=follows&access_token=${env.INSTAGRAM_ACCESS_TOKEN}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.follows === true;
}

async function sendDM(userId, message, env) {
  const url = `https://graph.facebook.com/v19.0/me/messages?access_token=${env.INSTAGRAM_ACCESS_TOKEN}`;
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: { user_id: userId },
      message: { text: message }
    })
  });
}

async function findTelegramPost(reelId, env) {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getChatHistory`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHANNEL_ID,
      limit: 100
    })
  });
  
  const data = await response.json();
  if (data.ok) {
    const targetPost = data.result.messages.find(msg => 
      msg.text?.includes(`Reel ID: ${reelId}`)
    );
    if (targetPost) {
      return `https://t.me/${env.TELEGRAM_CHANNEL_ID.replace('@', '')}/${targetPost.message_id}`;
    }
  }
  return null;
}
