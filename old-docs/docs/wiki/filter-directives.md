# What Are Filter Directives?

Filter Directives are a fancy way of *filtering* rows inside a table.

They provide an advanced toolkit for users to whittle down what they
actually want to see!

!!! tip
	You can tell if a field supports filter directives if it has a lightning
	bolt next to it. You can mouse over and click on the lightning bolt for
	more information about what filter directives are available!

## Simple Example

In the below examples, let's assume we're talking about a table of a users
scores.

By default, the filter bar loosely searches every column in the table. So if
you search for `AA`, You will get a list of all the scores that were on a song
that contains `AA` (such as `AA -rebuild-`) and all of the scores that have the grade
`AA` (OR `AAA`, as it's a loose match!).

!!! example
	![](../images/basic-search.png)
	Note the inclusion of AAAs and AAs? That's because it tries to match with as much as it can, as loosely as it can!

This isn't always what we want, though! What if I wanted to see only scores
on the song `AA`?

That's where Filter Directives come in. We can search for that using:

```
title=AA
```

Simple enough, right!

!!! example
	![](../images/title-search.png)
	Now, it only loosely matches on the title!

Now, depending on *where* you actually are, different filter directives are
available. The above example makes sense for filtering scores, but makes *no*
sense for filtering a table of users!

!!! tip
	You can *always* find out what directives are available by clicking the
	lightning bolt next to the field.

## Advanced Example

Before, we mentioned that this was a *powerful* toolkit for filtering rows
in a table. The above example is fairly mundane, though. What else can we do?

By default, a directive performs a loose match on that value, but we can
change that behaviour!

| Name | Example | What it does. |
| :: | :: | :: |
| Normal | `title=AA` | Matches any title that contains "AA". |
| Exact | `title==AA` | Matches any title that is *exactly* AA. |
| Not | `title!=AA` | Matches any title that does not contain AA. |
| Less Than | `percent<50` | Matches any percent that is less than 50. |
| Less Than Equal | `percent<=50` | Matches any percent that is less than or equal to 50. |
| Greater Than | `percent>50` | Matches any percent that is greater than 50. |
| Greater Than Equal | `percent>=50` | Matches any percent that is greater than or equal to 50. |
<!-- | Regex | `title:~^[a-z]*$` | Matches any title that matches the regex `^[a-z]*$` | -->
<!-- 
	Undocumented the regex stuff as, although its supported, it's completely pointless
	to ever document for end users. Honestly just an easter egg at this point.
!!! note
	Regex Mode refers to [Regular Expressions](https://en.wikipedia.org/wiki/Regular_expression).

	If you aren't familiar, don't worry! This specific mode is barely useful
	and for nerds. -->

## Other Things

You can use multiple directives in one filter!

`title==AA percent>50` - Find all scores on AA where the percent is greater than 50.

Multiple directives are separated by spaces. However, if you need to use a
space inside a value, you should quote it, like this:

`title="FREEDOM DiVE" percent>50`.

!!! tip
	If you need quotes *inside* that, you should escape them, like this:

	`artist="A Tribe Called \"Quest\"" percent>50`

	However, it is likely you will never need to use this.
