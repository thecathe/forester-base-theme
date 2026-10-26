<?xml version="1.0"?>
<!-- SPDX-License-Identifier: CC0-1.0 -->
<!--
  Colours that CSS would not understand. \fg, \bg and \color (trees/meta/styling.tree) write their colour
  twice: into the span's style, where CSS reads it, and into data-fg / data-bg, which is read here, at
  build time. A colour CSS would not accept is not an error to the browser, which drops the declaration
  and shows the text in the wrong colour, so it is said loudly instead, as deck.xsl does for content that
  is not a slide:

    - a WARNING printed while the pages are rendered (exit code 0), naming the page, the colour and why;
    - on the page, the text outlined in yellow with the reason in a label beside it, and as its tooltip.

  What is checked: a hex value (# and 3, 4, 6 or 8 hex digits), a name of a colour (the CSS ones and the
  system colours, and the keywords such as transparent and inherit), and the NAME of a colour function
  (rgb, hsl, oklch and the rest). What is inside a function's brackets is not looked at. An empty colour is
  fine: it is how \color is told to leave one of its two alone.

  Kept in its own file, with one include in default.xsl, so the rest of the theme stays close to upstream.
-->
<xsl:stylesheet version="1.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:f="http://www.forester-notes.org"
  xmlns:html="http://www.w3.org/1999/xhtml">

  <xsl:variable name="colour-upper" select="'ABCDEFGHIJKLMNOPQRSTUVWXYZ'" />
  <xsl:variable name="colour-lower" select="'abcdefghijklmnopqrstuvwxyz'" />

  <!-- Each name is wrapped in spaces, so that a name is looked for whole. -->
  <xsl:variable name="colour-names" select="concat(' aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen', ' transparent currentcolor inherit initial unset revert revert-layer', ' canvas canvastext linktext visitedtext activetext buttonface buttontext buttonborder field fieldtext highlight highlighttext selecteditem selecteditemtext mark marktext graytext accentcolor accentcolortext ')" />

  <xsl:variable name="colour-functions" select="' rgb rgba hsl hsla hwb lab lch oklab oklch color color-mix light-dark var '" />

  <!-- Why a colour is not one, or nothing if it is. -->
  <xsl:template name="colour-problem">
    <xsl:param name="value" />
    <xsl:variable name="v" select="translate(normalize-space($value), $colour-upper, $colour-lower)" />
    <xsl:variable name="length" select="string-length($v)" />
    <xsl:choose>
      <xsl:when test="$v = ''" />
      <xsl:when test="starts-with($v, '#')">
        <xsl:if test="not(contains(' 4 5 7 9 ', concat(' ', $length, ' '))) or translate(substring($v, 2), '0123456789abcdef', '') != ''">
          <xsl:text>a hex colour is # and 3, 4, 6 or 8 digits (0-9, a-f)</xsl:text>
        </xsl:if>
      </xsl:when>
      <xsl:when test="contains($v, '(')">
        <xsl:if test="not(contains($colour-functions, concat(' ', substring-before($v, '('), ' '))) or substring($v, $length) != ')'">
          <xsl:text>not a colour function (such as rgb, hsl, oklch) with its closing bracket</xsl:text>
        </xsl:if>
      </xsl:when>
      <xsl:when test="contains($colour-names, concat(' ', $v, ' '))" />
      <xsl:when test="translate($v, '0123456789abcdef', '') = '' and contains(' 3 4 6 8 ', concat(' ', $length, ' '))">
        <xsl:text>not a colour name; for a hex colour, put a # in front</xsl:text>
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>not a CSS colour name</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <!-- \fg, \bg, \color: the span as it is, and, if a colour is wrong, the warning. -->
  <xsl:template match="html:span[@data-fg or @data-bg]">
    <xsl:variable name="fg-problem">
      <xsl:call-template name="colour-problem"><xsl:with-param name="value" select="@data-fg" /></xsl:call-template>
    </xsl:variable>
    <xsl:variable name="bg-problem">
      <xsl:call-template name="colour-problem"><xsl:with-param name="value" select="@data-bg" /></xsl:call-template>
    </xsl:variable>
    <xsl:variable name="reason">
      <xsl:if test="$fg-problem != ''">“<xsl:value-of select="normalize-space(@data-fg)" />”: <xsl:value-of select="$fg-problem" />. </xsl:if>
      <xsl:if test="$bg-problem != ''">“<xsl:value-of select="normalize-space(@data-bg)" />”: <xsl:value-of select="$bg-problem" />. </xsl:if>
    </xsl:variable>

    <xsl:element namespace="http://www.w3.org/1999/xhtml" name="span">
      <xsl:copy-of select="@*" />
      <xsl:if test="$reason != ''">
        <xsl:attribute name="style">
          <xsl:value-of select="@style" />
          <xsl:text>; outline: .12em solid #f2b705; outline-offset: .08em</xsl:text>
        </xsl:attribute>
        <xsl:attribute name="title"><xsl:value-of select="normalize-space($reason)" /></xsl:attribute>
      </xsl:if>
      <xsl:apply-templates select="node()" />
    </xsl:element>
    <xsl:if test="$reason != ''">
      <xsl:element namespace="http://www.w3.org/1999/xhtml" name="span">
        <xsl:attribute name="style">margin: 0 .3em; padding: 0 .35em; font: 600 .6em/1.4 system-ui, sans-serif; color: #3b2c00; background: #f2b705; border-radius: .2em; opacity: 1</xsl:attribute>
        <xsl:text>⚠ </xsl:text>
        <xsl:value-of select="normalize-space($reason)" />
      </xsl:element>
      <xsl:message>WARNING colour <xsl:value-of select="ancestor::f:tree[last()]/f:frontmatter/f:uri" />: <xsl:value-of select="normalize-space($reason)" /> CSS would ignore it, so the text keeps its own colour. Fix the spelling, or write the colour another way.</xsl:message>
    </xsl:if>
  </xsl:template>

</xsl:stylesheet>
