<?xml version="1.0"?>
<!-- SPDX-License-Identifier: CC0-1.0 -->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:f="http://www.forester-notes.org">

  <xsl:include href="leads-to.xsl" />

  <!--
    On a deck, a link to another tree of the forest says where that tree itself leads, as data-leads-to on the link: the
    address of its \meta{redirect}, else of its first \meta{external}, or nothing when it has neither. A deck is shown and
    printed away from the forest (a talk on a stage, a PDF), where the tree's page is not a place to go, so deck-links.js
    sends the link to that address while presenting and printing, and makes it plain text when there is none. This is
    written for decks only: another page's links are as they were, and cost nothing.

    Where each tree leads is read from leads-to.xml, at the root of the output (the build writes it, with leads-to-index.xsl,
    over the few trees that lead anywhere). It has to be that and not each tree's own page, because a page is large and
    libxslt keeps every document it loads until the whole page is done: a deck that links to a hundred trees held them all,
    and a build rendering several decks at once ran out of memory. Without leads-to.xml (output not made by the build, say)
    the tree's page is read instead, which is the same answer at that cost.
  -->
  <xsl:variable name="links-lead" select="normalize-space(/f:tree/f:frontmatter/f:meta[@name='presentation']) = 'true'" />

  <!-- Read once, and only on a deck: the empty address of any other page is its own document, which has no <leads-to>. -->
  <xsl:variable name="leads-uri"><xsl:if test="$links-lead">../leads-to.xml</xsl:if></xsl:variable>
  <xsl:variable name="leads-index" select="document(string($leads-uri), /)/leads-to" />

  <xsl:template name="leads-to">
    <xsl:param name="href" />
    <xsl:variable name="route" select="substring-before(concat($href, '#'), '#')" />
    <xsl:choose>
      <xsl:when test="$leads-index">
        <xsl:value-of select="$leads-index/to[@route = $route][1]" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:call-template name="tree-leads-to">
          <xsl:with-param name="tree" select="document(concat('..', $route, 'index.xml'), /)/f:tree" />
        </xsl:call-template>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="text()[ancestor::f:link[1]/@href]">
    <a href="{ancestor::f:link[1]/@href}">
      <xsl:choose>
        <xsl:when test="ancestor::f:link[1]/@display-uri">
          <xsl:attribute name="title">
            <xsl:value-of select="ancestor::f:link[1]/@title" />
            <xsl:text> [</xsl:text>
            <xsl:value-of select="ancestor::f:link[1]/@display-uri" />
            <xsl:text>]</xsl:text>
          </xsl:attribute>
        </xsl:when>
        <xsl:otherwise>
          <xsl:attribute name="title">
            <xsl:value-of select="ancestor::f:link[1]/@title" />
          </xsl:attribute>
        </xsl:otherwise>
      </xsl:choose>
      <xsl:if test="$links-lead and ancestor::f:link[1]/@type = 'local'">
        <xsl:attribute name="data-leads-to">
          <xsl:call-template name="leads-to">
            <xsl:with-param name="href" select="ancestor::f:link[1]/@href" />
          </xsl:call-template>
        </xsl:attribute>
      </xsl:if>
      <xsl:value-of select="."/>
    </a>
  </xsl:template>

  <xsl:template match="f:link">
    <span class="link {@type}">
      <xsl:apply-templates  />
    </span>
  </xsl:template>

</xsl:stylesheet>
