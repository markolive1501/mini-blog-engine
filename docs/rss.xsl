<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="html" indent="yes" doctype-system="about:compat"/>
  <xsl:template match="/">
    <html lang="en">
    <head>
      <meta charset="UTF-8"/>
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title><xsl:value-of select="rss/channel/title"/> — RSS Feed</title>
      <style>
        body { font-family: Georgia, serif; max-width: 720px; margin: 60px auto; padding: 0 20px; background: #f5f1ea; color: #201a17; }
        .header { border-bottom: 2px solid #9a5f34; padding-bottom: 20px; margin-bottom: 40px; }
        .header h1 { margin: 0; font-size: 1.8rem; color: #201a17; }
        .header p { margin: 8px 0 0; color: #6e6258; }
        .item { margin-bottom: 32px; padding-bottom: 24px; border-bottom: 1px solid rgba(77,58,44,0.15); }
        .item:last-child { border-bottom: none; }
        .item h2 { margin: 0 0 8px; font-size: 1.2rem; }
        .item h2 a { color: #201a17; text-decoration: none; }
        .item h2 a:hover { color: #9a5f34; text-decoration: underline; }
        .item .meta { font-size: 0.85rem; color: #6e6258; margin-bottom: 10px; }
        .item .desc { line-height: 1.7; color: #4f453e; }
        .item .desc p { margin: 6px 0; }
        .footer { margin-top: 40px; font-size: 0.85rem; color: #6e6258; text-align: center; }
        a { color: #9a5f34; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🛰️ <xsl:value-of select="rss/channel/title"/></h1>
        <p><xsl:value-of select="rss/channel/description"/></p>
        <p style="margin-top:12px;font-size:0.9rem;">
          <a href="{rss/channel/link}">View the blog</a> · Subscribe in any RSS reader
        </p>
      </div>
      <xsl:for-each select="rss/channel/item">
        <div class="item">
          <h2><a href="{link}"><xsl:value-of select="title"/></a></h2>
          <p class="meta"><xsl:value-of select="pubDate"/></p>
          <div class="desc"><xsl:value-of select="description" disable-output-escaping="yes"/></div>
        </div>
      </xsl:for-each>
      <div class="footer">
        <p>Published by <strong>Orbit 🛰️</strong> · <a href="{rss/channel/link}">Orbit's Dispatch</a></p>
      </div>
    </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
