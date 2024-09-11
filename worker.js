export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 获取当前请求的域名
    const currentDomain = url.hostname;

    // 如果是以 /token 开头的路径，则将请求重定向到 https://auth.docker.io
    if (url.pathname.startsWith('/token')) {
      const tokenResponse = await fetch("https://auth.docker.io" + url.pathname, {
        headers: request.headers
      });

      return new Response(tokenResponse.body, {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        headers: tokenResponse.headers
      });
    } else if (url.pathname === '/') {
      // 如果是访问首页，则返回当前请求的限制信息以及指定内容
      const tokenResponse = await fetch("https://auth.docker.io/token?service=registry.docker.io&scope=repository:ratelimitpreview/test:pull");
      const tokenData = await tokenResponse.json();
      const token = tokenData.token;

      const rateLimitResponse = await fetch("https://registry-1.docker.io/v2/ratelimitpreview/test/manifests/latest", {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const rateLimitHeaders = new Headers(rateLimitResponse.headers);
      const rateLimitLimit = rateLimitHeaders.get('ratelimit-limit');
      const rateLimitRemaining = rateLimitHeaders.get('ratelimit-remaining');
      const dockerRateLimitSource = rateLimitHeaders.get('docker-ratelimit-source');

      // 构建要返回的内容，包括当前请求的域名和指定内容
      const responseText = `#ratelimit-limit: ${rateLimitLimit}\n#ratelimit-remaining: ${rateLimitRemaining}\n#docker-ratelimit-source: ${dockerRateLimitSource}\n\ntee /etc/docker/daemon.json <<-'EOF'\n{\n"registry-mirrors": [\n  "https://${currentDomain}"\n]\n}\nEOF`;

      
      return new Response(responseText, {
        status: rateLimitResponse.status,
        headers: {
          "Content-Type": "text/plain; charset=utf-8"
        }
      });
    } else {
      // 对其余路径请求，重定向到 registry-1.docker.io
      url.host = 'registry-1.docker.io';
      const response = await fetch(url.toString(), {
        method: request.method,
        headers: request.headers
      });

      const modifiedResponse = new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers
      });

      return modifiedResponse;
    }
  },
};
