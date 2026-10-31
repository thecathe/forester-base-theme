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
    data-title="..."      on all of them: the plain-text title (no markup, no numbering)
    data-layout="..."     on a unit with \meta{layout}{...}: how a slide is laid out (see deck.css)
    data-footer="..."     on a unit with \meta{footer}{none} or {show}: whether its slide has the footer
                          (see deck.js, buildFooters)
    data-deck-warn="..."  on a deck or section that holds content which is not a unit, so is never
                          presented: the reason, with a piece of what is lost (see deck-stray)

  A tree is marked only when every tree above it is a deck as well, so a deck nested inside
  a slide is ordinary content, and nothing in the backmatter (the context, backlinks and so
  on, which hold most of a deck page's sections) is ever marked.

  Three build warnings, printed by xsltproc while the pages are rendered (exit code 0): a
  section whose name is already taken, a section that has no usable name, and a deck or section
  with content that will not be presented. The last is also written into the page as
  data-deck-warn, which deck.css outlines in yellow and deck.js repeats while presenting.

  Kept in its own file, with one include in default.xsl and two call-templates in tree.xsl,
  so that the rest of the theme stays close to upstream's.
-->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:f="http://www.forester-notes.org"
  xmlns:html="http://www.w3.org/1999/xhtml">

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

  <!-- One "x" for each deck or section, before $me in the page (earlier, or one that holds it), whose name is $base:
       how many sections already have it, which is what the "-2" of a repeated name counts. -->
  <xsl:template name="deck-earlier">
    <xsl:param name="me" />
    <xsl:param name="base" />
    <xsl:variable name="page" select="$me/ancestor-or-self::f:tree[last()]" />
    <xsl:for-each select="$page/descendant-or-self::f:tree[normalize-space(f:frontmatter/f:meta[@name='presentation']) = 'true'][not(ancestor::f:backmatter)][not(ancestor::f:tree[not(normalize-space(f:frontmatter/f:meta[@name='presentation']) = 'true')])]">
      <xsl:variable name="other">
        <xsl:call-template name="deck-slugify"><xsl:with-param name="text" select="f:frontmatter/f:title/@text" /></xsl:call-template>
      </xsl:variable>
      <xsl:if test="$other = $base and count(. | $me/preceding::f:tree | $me/ancestor::f:tree) = count($me/preceding::f:tree | $me/ancestor::f:tree)">x</xsl:if>
    </xsl:for-each>
  </xsl:template>

  <!-- The link name of a deck or section ($me, a tree): its title as a link name, with "-2", "-3" for a name that is
       taken (the data-slug that deck-attributes writes, for a section that has no usable name an empty one). -->
  <xsl:template name="deck-slug">
    <xsl:param name="me" />
    <xsl:variable name="base">
      <xsl:call-template name="deck-slugify"><xsl:with-param name="text" select="$me/f:frontmatter/f:title/@text" /></xsl:call-template>
    </xsl:variable>
    <xsl:variable name="earlier">
      <xsl:call-template name="deck-earlier"><xsl:with-param name="me" select="$me" /><xsl:with-param name="base" select="$base" /></xsl:call-template>
    </xsl:variable>
    <xsl:value-of select="$base" />
    <xsl:if test="string-length($earlier) &gt; 0">
      <xsl:text>-</xsl:text>
      <xsl:value-of select="string-length($earlier) + 1" />
    </xsl:if>
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
      <xsl:attribute name="data-title"><xsl:value-of select="f:frontmatter/f:title/@text" /></xsl:attribute>
      <xsl:if test="normalize-space(f:frontmatter/f:meta[@name='layout']) != ''">
        <xsl:attribute name="data-layout"><xsl:value-of select="normalize-space(f:frontmatter/f:meta[@name='layout'])" /></xsl:attribute>
      </xsl:if>
      <xsl:if test="normalize-space(f:frontmatter/f:meta[@name='footer']) != ''">
        <xsl:attribute name="data-footer"><xsl:value-of select="normalize-space(f:frontmatter/f:meta[@name='footer'])" /></xsl:attribute>
      </xsl:if>

      <xsl:if test="$is-deck">
        <xsl:variable name="page" select="ancestor-or-self::f:tree[last()]" />
        <xsl:variable name="me" select="." />
        <xsl:variable name="title" select="f:frontmatter/f:title/@text" />
        <xsl:variable name="base">
          <xsl:call-template name="deck-slugify"><xsl:with-param name="text" select="$title" /></xsl:call-template>
        </xsl:variable>

        <!-- One "x" for each deck or section, earlier in the page, with the same name. -->
        <xsl:variable name="earlier">
          <xsl:call-template name="deck-earlier"><xsl:with-param name="me" select="$me" /><xsl:with-param name="base" select="$base" /></xsl:call-template>
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

        <!-- Only units are presented, so anything else a deck or section holds (text, a paragraph,
             a list) is lost on the stage and in print. What is allowed, because it is not meant to be
             shown as it stands, is taken out of $stray here, and nowhere else: so far the footer
             definition (\footer, trees/meta/footer.tree), which deck.js draws on each slide, and speaker
             notes (\notes, trees/meta/notes.tree), which deck-notes.js shows on request. -->
        <xsl:variable name="stray" select="f:mainmatter/*[not(self::f:tree)][not(self::html:div and @class = 'deck-footer-def')][not(self::html:aside and @class = 'deck-notes')] | f:mainmatter/text()[normalize-space(.) != '']" />
        <xsl:if test="$stray">
          <xsl:variable name="text" select="normalize-space(string($stray[1]))" />
          <xsl:variable name="piece">
            <xsl:choose>
              <xsl:when test="string-length($text) &gt; 48">“<xsl:value-of select="substring($text, 1, 48)" />…”</xsl:when>
              <xsl:when test="$text != ''">“<xsl:value-of select="$text" />”</xsl:when>
              <xsl:when test="$stray[1][self::*]">(a <xsl:value-of select="local-name($stray[1])" /> element with no text)</xsl:when>
            </xsl:choose>
          </xsl:variable>
          <xsl:variable name="reason">
            <xsl:text>Content that is not a slide, so it is not presented: </xsl:text>
            <xsl:value-of select="$piece" />
            <xsl:if test="count($stray) &gt; 1"> and <xsl:value-of select="count($stray) - 1" /> more</xsl:if>
            <xsl:text>.</xsl:text>
          </xsl:variable>
          <xsl:attribute name="data-deck-warn"><xsl:value-of select="$reason" /></xsl:attribute>
          <xsl:message>WARNING deck <xsl:value-of select="$page/f:frontmatter/f:uri" />: <xsl:choose><xsl:when test="not(parent::f:mainmatter/parent::f:tree)">the deck</xsl:when><xsl:otherwise>the section</xsl:otherwise></xsl:choose> "<xsl:value-of select="$title" />" holds content that is not a slide, so it will not be presented (<xsl:value-of select="count($stray)" /> piece<xsl:if test="count($stray) != 1">s</xsl:if>, the first is <xsl:value-of select="$piece" />). Put it in a slide, or take it out.</xsl:message>
        </xsl:if>
      </xsl:if>
    </xsl:if>
  </xsl:template>

  <!-- \goto{target}{text} (trees/meta/navigation.tree): a link to a slide of the page's own deck, which comes here with no
       address. The target is one of the three forms deck.js reads from the address (parseHash, which this repeats): slide-3, a
       section's name, or name/2, with or without a leading #. When it points somewhere the link gets that address, and is
       drawn as any link is. When it points nowhere it is said loudly, in the way the other deck problems are:
         - a WARNING printed while the pages are rendered (exit code 0), naming the page, the link and why;
         - on the page, the link drawn in red (deck-link-broken) with the reason as its title, so on hover.
       Only the page's own deck can be looked at (every name and slide count is in front of this stylesheet, and nothing of any
       other page is), so a link on a page that is not a deck, or in its backmatter (a slide shown on some other page), is left
       as text. A position (slide-3) means the slide of the page it is on; a name does not move. -->
  <xsl:template match="html:a[@class = 'deck-link']" priority="2">
    <xsl:variable name="page" select="ancestor::f:tree[last()]" />
    <xsl:variable name="sections" select="$page/descendant-or-self::f:tree[normalize-space(f:frontmatter/f:meta[@name='presentation']) = 'true'][not(ancestor::f:backmatter)][not(ancestor::f:tree[not(normalize-space(f:frontmatter/f:meta[@name='presentation']) = 'true')])]" />
    <xsl:choose>
      <xsl:when test="not($sections) or ancestor::f:backmatter">
        <xsl:element namespace="http://www.w3.org/1999/xhtml" name="span">
          <xsl:attribute name="class">deck-link deck-link-inert</xsl:attribute>
          <xsl:apply-templates select="node()" />
        </xsl:element>
      </xsl:when>
      <xsl:otherwise>
        <!-- the slides of the page's deck, as deck.js counts them: a unit that is not itself a section -->
        <xsl:variable name="slides" select="$page/descendant::f:tree[parent::f:mainmatter/parent::f:tree][not(ancestor::f:backmatter)][not(ancestor::f:tree[not(normalize-space(f:frontmatter/f:meta[@name='presentation']) = 'true')])][not(normalize-space(f:frontmatter/f:meta[@name='presentation']) = 'true')]" />
        <xsl:variable name="written" select="normalize-space(@data-goto)" />
        <xsl:variable name="target">
          <xsl:choose>
            <xsl:when test="starts-with($written, '#')"><xsl:value-of select="substring($written, 2)" /></xsl:when>
            <xsl:otherwise><xsl:value-of select="$written" /></xsl:otherwise>
          </xsl:choose>
        </xsl:variable>
        <xsl:variable name="position" select="substring-after($target, 'slide-')" />
        <xsl:variable name="is-position" select="starts-with($target, 'slide-') and $position != '' and translate($position, '0123456789', '') = ''" />
        <xsl:variable name="name">
          <xsl:choose>
            <xsl:when test="contains($target, '/')"><xsl:value-of select="substring-before($target, '/')" /></xsl:when>
            <xsl:otherwise><xsl:value-of select="$target" /></xsl:otherwise>
          </xsl:choose>
        </xsl:variable>
        <xsl:variable name="rest" select="substring-after($target, '/')" />
        <xsl:variable name="shaped" select="$name != '' and (not(contains($target, '/')) or ($rest != '' and translate($rest, '0123456789', '') = ''))" />
        <!-- the slide counts of the sections called $name (the first of them is the one deck.js links to) -->
        <xsl:variable name="found">
          <xsl:if test="$shaped and not($is-position)">
            <xsl:for-each select="$sections">
              <xsl:variable name="slug">
                <xsl:call-template name="deck-slug"><xsl:with-param name="me" select="." /></xsl:call-template>
              </xsl:variable>
              <xsl:if test="$slug = $name">
                <xsl:value-of select="count($slides[count(ancestor::f:tree | current()) = count(ancestor::f:tree)])" />
                <xsl:text>,</xsl:text>
              </xsl:if>
            </xsl:for-each>
          </xsl:if>
        </xsl:variable>
        <xsl:variable name="inside" select="substring-before($found, ',')" />
        <xsl:variable name="n">
          <xsl:choose>
            <xsl:when test="$rest = ''">1</xsl:when>
            <xsl:otherwise><xsl:value-of select="number($rest)" /></xsl:otherwise>
          </xsl:choose>
        </xsl:variable>

        <xsl:variable name="reason">
          <xsl:choose>
            <xsl:when test="$target = ''">it names nothing: give slide-3, the name of a section, or name/2</xsl:when>
            <xsl:when test="$is-position">
              <xsl:if test="number($position) &lt; 1 or number($position) &gt; count($slides)">
                <xsl:text>there is no slide </xsl:text><xsl:value-of select="number($position)" />
                <xsl:text> (this deck has </xsl:text><xsl:value-of select="count($slides)" />
                <xsl:text> slide</xsl:text><xsl:if test="count($slides) != 1">s</xsl:if><xsl:text>)</xsl:text>
              </xsl:if>
            </xsl:when>
            <xsl:when test="not($shaped)">it is not a slide address: use slide-3, the name of a section, or name/2</xsl:when>
            <xsl:when test="$found = ''">
              <xsl:text>there is no section called “</xsl:text><xsl:value-of select="$name" />
              <xsl:text>” (a name is the title in lower case, with hyphens between the words)</xsl:text>
            </xsl:when>
            <xsl:when test="$inside = '0'">the section “<xsl:value-of select="$name" />” has no slides</xsl:when>
            <xsl:when test="$n &lt; 1 or $n &gt; number($inside)">
              <xsl:text>the section “</xsl:text><xsl:value-of select="$name" />
              <xsl:text>” has </xsl:text><xsl:value-of select="$inside" />
              <xsl:text> slide</xsl:text><xsl:if test="$inside != '1'">s</xsl:if>
              <xsl:text>, so there is no slide </xsl:text><xsl:value-of select="$n" /><xsl:text> in it</xsl:text>
            </xsl:when>
          </xsl:choose>
        </xsl:variable>

        <xsl:element namespace="http://www.w3.org/1999/xhtml" name="a">
          <xsl:copy-of select="@*[name() != 'class']" />
          <xsl:attribute name="class">
            <xsl:text>deck-link</xsl:text>
            <xsl:if test="$reason != ''"> deck-link-broken</xsl:if>
          </xsl:attribute>
          <xsl:attribute name="href">#<xsl:value-of select="$target" /></xsl:attribute>
          <xsl:if test="$reason != ''">
            <xsl:attribute name="title">This link goes nowhere: <xsl:value-of select="$reason" />.</xsl:attribute>
          </xsl:if>
          <xsl:apply-templates select="node()" />
        </xsl:element>
        <xsl:if test="$reason != ''">
          <xsl:message>WARNING link <xsl:value-of select="$page/f:frontmatter/f:uri" />: the link “<xsl:value-of select="normalize-space(string(.))" />” goes to #<xsl:value-of select="$target" />, but <xsl:value-of select="$reason" />. Fix the target, or take the link out.</xsl:message>
        </xsl:if>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

</xsl:stylesheet>
