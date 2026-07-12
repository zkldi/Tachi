use utf8;BEGIN { $| = 1 };
sub _ {
	my $palindrome = join"",map{chr} "10","07";
	my($α,$λ,$ι,$ς,$ε)=@_;
	$λ//=1;$ι//=1;select undef,undef,undef,$λ+rand($ι-$λ);my@υ=split" ",($α^substr($palindrome,0,1)x length$α^substr($palindrome,1,1)x length$α);my%δ;@δ{@υ<3?(0):(do{my%ε;grep{!$ε{$_}++}map{int rand@υ}1..3})}=();for(0..$#υ){print+(exists$δ{$_}?"\e[38;2;@{[join';',map{int rand 256}1..3]}m$υ[$_]\e[0m":$υ[$_]);$_<$#υ&&do{print" ";select undef,undef,undef,.03+rand.07}}print$/
};

_("Yeh\x7fh*~-~b`hyedcj-dc-yeh-ld\x7f-eh\x7fh",0,0);
_("Dy-`lfh~-tbx-jb-dc~lch",1,2);
_("O\x7fdcj~-tbx-olnf-yb-`h",1,2);
_("Dy*~-ohhc-~b-abcj",3,4);
_("",0,1);
_("\x45\x68\x74\x21\x2d\x6f\x6c\x6f\x74\x23\x23\x23",3,4);
_("\x45\x68\x74\x21\x2d\x7e\x7a\x68\x68\x79\x65\x68\x6c\x7f\x79\x23\x23\x23",3,4);
_("\x45\x68\x74\x21\x2d\x6b\x62\x75\x21\x2d\x6e\x62\x60\x68\x2d\x65\x68\x7f\x68",0,1);
_("Eht!-ohlxydkxa",3,4);
_("Nb`h-eh\x7fh!-~xjl\x7f",3,4);
_("",3,3);