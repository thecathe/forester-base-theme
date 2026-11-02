<?xml version="1.0"?>
<!-- SPDX-License-Identifier: CC0-1.0 -->
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform" xmlns:f="http://www.forester-notes.org">

  <!--
    Where a tree itself leads: the address of its \meta{redirect}, else of its first \meta{external}, or nothing when it has
    neither. This is the one place that says so. It is used by links.xsl, to fall back on reading the tree's page, and by
    leads-to-index.xsl, which the build runs over each page to make leads-to.xml (see links.xsl for why).
  -->
  <xsl:template name="tree-leads-to">
    <xsl:param name="tree" /><!-- an f:tree, the root of a tree's own page -->
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

</xsl:stylesheet>
