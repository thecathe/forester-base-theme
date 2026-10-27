<?xml version="1.0"?>
<!-- SPDX-License-Identifier: CC0-1.0 -->
<!--
  A \clearstep (trees/meta/fragments.tree) is only meaningful as the last child of a \steps or a \pairs, straight after
  the \step whose picture it ends. Anywhere else deck.js would ignore it, which would leave a picture on the slide that
  the author meant to clear, so it is said loudly instead, as colour.xsl does for a colour CSS would not know:

    - a WARNING printed while the pages are rendered (exit code 0), naming the page and why;
    - on the page, in place of the mark, a yellow label with the reason.

  A \clearstep that is where it belongs is copied as it stands (and drawn as nothing, by deck.css).

  Kept in its own file, with one include in default.xsl, so the rest of the theme stays close to upstream.
-->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:f="http://www.forester-notes.org"
  xmlns:html="http://www.w3.org/1999/xhtml">

  <xsl:template match="html:div[@class = 'clear-step']">
    <xsl:variable name="reason">
      <xsl:choose>
        <xsl:when test="not(parent::html:div[@class = 'steps' or @class = 'pairs'])">it is not inside a \steps or a \pairs</xsl:when>
        <xsl:when test="following-sibling::*">it is not the last child of its block</xsl:when>
        <xsl:when test="not(preceding-sibling::*[1][self::html:div[@class = 'step']])">it does not follow a \step, so there is no picture for it to clear</xsl:when>
      </xsl:choose>
    </xsl:variable>
    <xsl:choose>
      <xsl:when test="$reason = ''">
        <xsl:element namespace="http://www.w3.org/1999/xhtml" name="div">
          <xsl:copy-of select="@*" />
        </xsl:element>
      </xsl:when>
      <xsl:otherwise>
        <!-- not a .clear-step any more, so deck.js and deck.css leave it alone -->
        <xsl:element namespace="http://www.w3.org/1999/xhtml" name="div">
          <xsl:attribute name="class">clear-step-misplaced</xsl:attribute>
          <xsl:attribute name="style">grid-column: 1 / -1; margin: .3em 0; padding: 0 .35em; font: 600 .6em/1.6 system-ui, sans-serif; color: #3b2c00; background: #f2b705; border-radius: .2em</xsl:attribute>
          <xsl:text>⚠ \clearstep: </xsl:text>
          <xsl:value-of select="$reason" />
        </xsl:element>
        <xsl:message>WARNING clearstep <xsl:value-of select="ancestor::f:tree[last()]/f:frontmatter/f:uri" />: a \clearstep is ignored, because <xsl:value-of select="$reason" />. Put it last in the block, straight after the \step it should clear, or take it out.</xsl:message>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

</xsl:stylesheet>
