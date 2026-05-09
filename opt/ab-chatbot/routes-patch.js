// This is sourced BEFORE the 404 handler via sed
// Add customer chat route
if (req.method === 'POST' && url === '/api/chat') {
  try {
    const body = await parseBody(req);
    const result = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'You are the AB Concierge for AB Entertainment Melbourne. Help with events, tickets. Contact: (+61) 430082646 / abhi@abentertainment.com.au.' },
        ...(body.messages || []).slice(-20),
      ],
      stream: true, max_tokens: 1000,
    });
    res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
    for await (const chunk of result) {
      const c = chunk.choices?.[0]?.delta?.content;
      if (c) res.write(c);
    }
    res.end();
  } catch (e) { res.writeHead(500); res.end(JSON.stringify({error:e.message})); }
  return;
}

// Admin chat = agent chat alias
if (req.method === 'POST' && url === '/api/admin/chat') {
  try {
    const body = await parseBody(req);
    const sessionId = body.sessionId || 'admin';
    const response = await handleAgentChat(body.messages || [], sessionId);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ response, productionApproved }));
  } catch (e) { res.writeHead(500); res.end(JSON.stringify({error:e.message})); }
  return;
}

// Auth
if (req.method === 'POST' && url === '/api/admin/auth') {
  const body = await parseBody(req);
  if (body.username === 'admin' && body.password === 'admin123') {
    res.writeHead(200); res.end(JSON.stringify({success:true, token: crypto.randomBytes(32).toString('hex')}));
  } else {
    res.writeHead(401); res.end(JSON.stringify({error:'Invalid credentials'}));
  }
  return;
}
if (req.method === 'DELETE' && url === '/api/admin/auth') {
  res.writeHead(200); res.end(JSON.stringify({success:true}));
  return;
}

// Contact
if (req.method === 'POST' && url === '/api/contact') {
  const body = await parseBody(req);
  if (!body.name || !body.email || !body.message) {
    res.writeHead(400); res.end(JSON.stringify({error:'Fields required'}));
    return;
  }
  res.writeHead(200); res.end(JSON.stringify({success:true, message:'Sent successfully'}));
  return;
}
