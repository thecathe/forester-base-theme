<?xml version="1.0"?>
<!-- SPDX-License-Identifier: CC0-1.0 -->
<!--
  Deck mode, build time. A tree is a deck when it has \meta{presentation}{true}.

  The children of a deck are its units. A unit that is itself a deck is a section (and its
  own children are units in turn); any other unit is a slide. This file writes that into the
  page, so that CSS, deck.js and print all read the same marks and none of them works it out
  again:

    data-deck="deck"      the page's own tree
    data-deck="section"   a nested deck
    data-deck="slide"     any other direct child of a deck or section
    data-slug="..."       on a deck or section: its title as a link name (see deck-slugify)

  A tree is marked only when every tree above it is a deck as well, so a deck nested inside
  a slide is ordinary content, and nothing in the backmatter (the context, backlinks and so
  on, which hold most of a deck page's sections) is ever marked.

  Two build warnings, printed by xsltproc while the pages are rendered (exit code 0): a
  section whose name is already taken, and a section that has no usable name.

  Kept in its own file, with one include in default.xsl and two call-templates in tree.xsl,
  so that the rest of the theme stays close to upstream's.
-->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:f="http://www.forester-notes.org">

  <xsl:variable name="deck-upper" select="'ABCDEFGHIJKLMNOPQRSTUVWXYZ'" />
  <xsl:variable name="deck-lower" select="'abcdefghijklmnopqrstuvwxyz'" />
  <xsl:variable name="deck-alnum" select="'abcdefghijklmnopqrstuvwxyz0123456789'" />
  <!-- 128 blanks: translate() only maps the characters that have a counterpart. -->
  <xsl:variable name="deck-blanks" select="'                                                                                                                                '" />

  <!-- A title as a link name: lower case, every run of characters other than a-z and 0-9 becomes
       one hyphen, none at either end. ASCII only: any other letter counts as a separator. -->
  <xsl:template name="deck-slugify">
    <xsl:param name="text" />
    <xsl:variable name="lower" select="translate($text, $deck-upper, $deck-lower)" />
    <xsl:variable name="others" select="translate($lower, $deck-alnum, '')" />
    <xsl:value-of select="translate(normalize-space(translate($lower, $others, $deck-blanks)), ' ', '-')" />
  </xsl:template>

  <!-- In the page's <head>: the deck's stylesheet and script, on a deck page only. -->
  <xsl:template name="deck-head">
    <xsl:if test="normalize-space(/f:tree/f:frontmatter/f:meta[@name='presentation']) = 'true'">
      <link rel="stylesheet" href="{/f:tree/@base-url}deck.css" />
      <script type="module" src="{/f:tree/@base-url}deck.js"></script>
    </xsl:if>
  </xsl:template>

  <!-- Inside a tree's <section> start tag, with the context node the tree: its marks. -->
  <xsl:template name="deck-attributes">
    <xsl:variable name="is-deck" select="normalize-space(f:frontmatter/f:meta[@name='presentation']) = 'true'" />
    <xsl:variable name="chain-is-deck" select="not(ancestor::f:tree[not(normalize-space(f:frontmatter/f:meta[@name='presentation']) = 'true')])" />

    <xsl:if test="not(ancestor::f:backmatter) and $chain-is-deck and ($is-deck or parent::f:mainmatter/parent::f:tree)">
      <xsl:attribute name="data-deck">
        <xsl:choose>
          <xsl:when test="not(parent::f:mainmatter/parent::f:tree)">deck</xsl:when>
          <xsl:when test="$is-deck">section</xsl:when>
          <xsl:otherwise>slide</xsl:otherwise>
        </xsl:choose>
      </xsl:attribute>

      <xsl:if test="$is-deck">
        <xsl:variable name="page" select="ancestor-or-self::f:tree[last()]" />
        <xsl:variable name="me" select="." />
        <xsl:variable name="title" select="f:frontmatter/f:title/@text" />
        <xsl:variable name="base">
          <xsl:call-template name="deck-slugify"><xsl:with-param name="text" select="$title" /></xsl:call-template>
        </xsl:variable>

        <!-- One "x" for each deck or section, earlier in the page, with the same name. -->
        <xsl:variable name="earlier">
          <xsl:for-each select="$page/descendant-or-self::f:tree[normalize-space(f:frontmatter/f:meta[@name='presentation']) = 'true'][not(ancestor::f:backmatter)][not(ancestor::f:tree[not(normalize-space(f:frontmatter/f:meta[@name='presentation']) = 'true')])]">
            <xsl:variable name="other">
              <xsl:call-template name="deck-slugify"><xsl:with-param name="text" select="f:frontmatter/f:title/@text" /></xsl:call-template>
            </xsl:variable>
            <xsl:if test="$other = $base and count(. | $me/preceding::f:tree | $me/ancestor::f:tree) = count($me/preceding::f:tree | $me/ancestor::f:tree)">x</xsl:if>
          </xsl:for-each>
        </xsl:variable>

        <xsl:variable name="slug">
          <xsl:value-of select="$base" />
          <xsl:if test="string-length($earlier) &gt; 0">
            <xsl:text>-</xsl:text>
            <xsl:value-of select="string-length($earlier) + 1" />
          </xsl:if>
        </xsl:variable>
        <xsl:attribute name="data-slug"><xsl:value-of select="$slug" /></xsl:attribute>

        <xsl:if test="$base = ''">
          <xsl:message>WARNING deck <xsl:value-of select="$page/f:frontmatter/f:uri" />: the section titled "<xsl:value-of select="$title" />" has no letters or digits to make a link name from, so it cannot be linked to by name.</xsl:message>
        </xsl:if>
        <xsl:if test="$base != '' and string-length($earlier) &gt; 0">
          <xsl:message>WARNING deck <xsl:value-of select="$page/f:frontmatter/f:uri" />: the section "<xsl:value-of select="$title" />" has the same name as an earlier section, so its link is #<xsl:value-of select="$slug" />, not #<xsl:value-of select="$base" />.</xsl:message>
        </xsl:if>
      </xsl:if>
    </xsl:if>
  </xsl:template>

</xsl:stylesheet>
