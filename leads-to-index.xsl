<?xml version="1.0"?>
<!-- SPDX-License-Identifier: CC0-1.0 -->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:f="http://www.forester-notes.org">

  <!--
    Not part of a page's stylesheet (default.xsl does not include it): the build runs it over a tree's index.xml, one tree at
    a time, and collects what it writes into leads-to.xml, at the root of the output, which links.xsl reads. It writes
    <to route="/addr/">address</to> for a tree that leads somewhere, and nothing for one that does not. The route is the tree's
    own, as a link to it writes it (so /%23foo/ for #foo).
  -->
  <xsl:output method="xml" encoding="utf-8" omit-xml-declaration="yes" />
  <xsl:include href="leads-to.xsl" />

  <xsl:template match="/">
    <xsl:apply-templates select="f:tree" />
  </xsl:template>

  <xsl:template match="f:tree">
    <xsl:variable name="to">
      <xsl:call-template name="tree-leads-to">
        <xsl:with-param name="tree" select="." />
      </xsl:call-template>
    </xsl:variable>
    <xsl:if test="string($to) != ''">
      <to route="{f:frontmatter/f:route}"><xsl:value-of select="$to" /></to>
    </xsl:if>
  </xsl:template>

</xsl:stylesheet>
