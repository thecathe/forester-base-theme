<?xml version="1.0"?>
<!-- SPDX-License-Identifier: CC0-1.0 -->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:f="http://www.forester-notes.org">

  <!--
    On a deck, a link to another tree of the forest says where that tree itself leads, as data-leads-to on the link: the
    address of its \meta{redirect}, else of its first \meta{external}, or nothing when it has neither. A deck is shown and
    printed away from the forest (a talk on a stage, a PDF), where the tree's page is not a place to go, so deck-links.js
    sends the link to that address while presenting and printing, and makes it plain text when there is none. The tree's
    own page is read for it (its index.xml, next to this page's), so this is written for decks only: another page's links
    are as they were, and cost nothing.
  -->
  <xsl:variable name="links-lead" select="normalize-space(/f:tree/f:frontmatter/f:meta[@name='presentation']) = 'true'" />

  <xsl:template name="leads-to">
    <xsl:param name="href" />
    <xsl:variable name="tree" select="document(concat('..', substring-before(concat($href, '#'), '#'), 'index.xml'), /)/f:tree" />
    <xsl:variable name="redirect" select="$tree/f:frontmatter/f:meta[@name='redirect'][1]" />
    <xsl:variable name="external" select="$tree/f:frontmatter/f:meta[@name='external'][1]" />
    <xsl:variable name="meta" select="$redirect | $external[not($redirect)]" />
    <xsl:choose>
      <!-- Rich content such as [foo.com](https://foo.com): the link's address, as metadata.xsl does. -->
      <xsl:when test="$meta//f:link/@href">
        <xsl:value-of select="($meta//f:link/@href)[1]" />
      </xsl:when>
      <xsl:otherwise>
        <xsl:value-of select="normalize-space($meta)" />
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
