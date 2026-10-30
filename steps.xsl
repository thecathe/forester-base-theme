<?xml version="1.0"?>
<!--
  \clearstep (trees/meta/fragments.tree) has two forms, told apart here, at build time:

    \clearstep{}        a mark. Last child of a \steps or a \pairs, straight after a \step: deck.js ends that row's picture when the
                        first fragment after the block arrives. It has no row of its own (and deck.css draws it as nothing).
    \clearstep{text}    a row of text and no picture, as a \step without its picture: it clears the right column as any next
                        row does. Written here as a step of class "step step-blank", so the rest of the machinery sees a row.

  A mark that is not where it belongs, or a \clearstep outside a \steps and a \pairs, would be ignored by deck.js, which would
  leave a picture on the slide that the author meant to clear, so it is said loudly instead, as colour.xsl does for a colour CSS
  would not know:

    - a WARNING printed while the pages are rendered (exit code 0), naming the page and why;
    - on the page, in place of the mark, a yellow label with the reason.

  Kept in its own file, with one include in default.xsl, so the rest of the theme stays close to upstream.
-->
<!--
  A \clearstep (trees/meta/fragments.tree) is only meaningful as the last child of a \steps or a \pairs, straight after
  the \step whose picture it ends. Anywhere else deck.js would ignore it, which would leave a picture on the slide that
  the author meant to clear, so it is said loudly instead, as colour.xsl does for a colour CSS would not know:

    - a WARNING printed while the pages are rendered (exit code 0), naming the page and why;
    - on the page, in place of the mark, a yellow label with the reason.

  A \clearstep that is where it belongs is copied as it stands (and drawn as nothing, by deck.css).

  The same file checks when a fragment says it arrives (\fragmenti, \reveali, \flipi, \last: data-step-from). It has to be a
  number, "with", "end" or nothing; anything else is said loudly, as above, and the fragment is then in the order written.

  Kept in its own file, with one include in default.xsl, so the rest of the theme stays close to upstream.
-->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:f="http://www.forester-notes.org"
  xmlns:html="http://www.w3.org/1999/xhtml">

  <!-- A word of a class attribute, so that "step substep" is a step. -->
  <xsl:template name="has-class">
    <xsl:param name="class" />
    <xsl:param name="word" />
    <xsl:if test="contains(concat(' ', normalize-space($class), ' '), concat(' ', $word, ' '))">yes</xsl:if>
  </xsl:template>

  <!-- When a fragment arrives: a whole number, "with", "end", or nothing. Anything else is a mistake in the source, which
       deck.js would take for "nothing": the label and the warning say so. The element is copied as core.xsl copies one. -->
  <xsl:template match="html:*[@data-step-from]" priority="2">
    <xsl:variable name="when" select="normalize-space(@data-step-from)" />
    <xsl:variable name="reason">
      <xsl:choose>
        <xsl:when test="$when = '' or $when = 'with' or $when = 'end'" />
        <xsl:when test="translate($when, '0123456789', '') = ''" />
        <xsl:otherwise>
          <xsl:text>“</xsl:text><xsl:value-of select="$when" /><xsl:text>” is not a press number, “with” or “end”</xsl:text>
        </xsl:otherwise>
      </xsl:choose>
    </xsl:variable>
    <xsl:element namespace="http://www.w3.org/1999/xhtml" name="{local-name()}">
      <xsl:apply-templates select="@*[$reason = '' or name() != 'data-step-from'] | node()" />
    </xsl:element>
    <xsl:if test="$reason != ''">
      <xsl:element namespace="http://www.w3.org/1999/xhtml" name="span">
        <xsl:attribute name="style">margin: 0 .3em; padding: 0 .35em; font: 600 .6em/1.4 system-ui, sans-serif; color: #3b2c00; background: #f2b705; border-radius: .2em; opacity: 1</xsl:attribute>
        <xsl:text>⚠ when: </xsl:text>
        <xsl:value-of select="$reason" />
      </xsl:element>
      <xsl:message>WARNING step <xsl:value-of select="ancestor::f:tree[last()]/f:frontmatter/f:uri" />: <xsl:value-of select="$reason" />, so it arrives in the order written. Give a number, with, end, or nothing.</xsl:message>
    </xsl:if>
  </xsl:template>

  <xsl:template match="html:div[@class = 'clear-step']">
    <xsl:variable name="in-block" select="parent::html:div[@class = 'steps' or @class = 'pairs']" />
    <xsl:variable name="empty" select="normalize-space(string(.)) = '' and not(*)" />
    <xsl:variable name="before">
      <xsl:call-template name="has-class">
        <xsl:with-param name="class" select="preceding-sibling::*[1]/@class" />
        <xsl:with-param name="word" select="'step'" />
      </xsl:call-template>
    </xsl:variable>
    <xsl:variable name="reason">
      <xsl:choose>
        <xsl:when test="not($in-block)">it is not inside a \steps or a \pairs</xsl:when>
        <xsl:when test="$empty and following-sibling::*">an empty one has to be the last child of its block</xsl:when>
        <xsl:when test="$empty and $before != 'yes'">an empty one has to follow a \step, whose picture it clears</xsl:when>
      </xsl:choose>
    </xsl:variable>
    <xsl:choose>
      <xsl:when test="$reason != ''">
        <!-- not a .clear-step any more, so deck.js and deck.css leave it alone -->
        <xsl:element namespace="http://www.w3.org/1999/xhtml" name="div">
          <xsl:attribute name="class">clear-step-misplaced</xsl:attribute>
          <xsl:attribute name="style">grid-column: 1 / -1; margin: .3em 0; padding: 0 .35em; font: 600 .6em/1.6 system-ui, sans-serif; color: #3b2c00; background: #f2b705; border-radius: .2em</xsl:attribute>
          <xsl:text>⚠ \clearstep: </xsl:text>
          <xsl:value-of select="$reason" />
        </xsl:element>
        <xsl:message>WARNING clearstep <xsl:value-of select="ancestor::f:tree[last()]/f:frontmatter/f:uri" />: a \clearstep is ignored, because <xsl:value-of select="$reason" />. Put it where it belongs, or take it out.</xsl:message>
      </xsl:when>
      <xsl:when test="$empty">
        <!-- the mark: no row of its own (deck.js, stepsOf) -->
        <xsl:element namespace="http://www.w3.org/1999/xhtml" name="div">
          <xsl:copy-of select="@*" />
        </xsl:element>
      </xsl:when>
      <xsl:otherwise>
        <!-- with text: a row of text and no picture, which clears the right column as any next row does -->
        <xsl:element namespace="http://www.w3.org/1999/xhtml" name="div">
          <xsl:attribute name="class">step step-blank</xsl:attribute>
          <xsl:element namespace="http://www.w3.org/1999/xhtml" name="div">
            <xsl:attribute name="class">step-text fragment</xsl:attribute>
            <xsl:apply-templates select="node()" />
          </xsl:element>
        </xsl:element>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

</xsl:stylesheet>
