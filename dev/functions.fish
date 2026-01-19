function rgb
	function hextorgb
		set r $(string sub $argv[1] -l 2)
		set g $(string sub $argv[1] -l 2 -s 3)
		set b $(string sub $argv[1] -l 2 -s 5)

		set r $(python3 -c "print(int(\"$r\", 16))")
		set g $(python3 -c "print(int(\"$g\", 16))")
		set b $(python3 -c "print(int(\"$b\", 16))")

		string join ';' $r $g $b
	end

	printf "\033[38;2;%sm" $(hextorgb $argv[2])
	
	if test (count $argv) -eq 3
		printf "\033[48;2;%sm" $(hextorgb $argv[3])
	end

	printf "%s" $argv[1]
	printf "\033[0m"
end

function cmd
	rgb $argv[1] e61c6e 000000
end



function fish_greeting
	# check $PATH is correct
	if not contains ~/.local/pnpm $PATH
		fish_add_path ~/.local/pnpm
	end

	echo "Welcome to $(rgb "Tachi" e61c6e 131313)!"

	if ! test -e /tachi/BOOTSTRAP_OK
		echo ""
		echo $(rgb "Something went wrong and Tachi didn't set up correctly." ff0000 000000)
		echo ""
		echo $(rgb "Please run" ff0000 000000) $(cmd "just bootstrap"). $(rgb "An incorrectly setup Tachi might not launch." ff0000 000000)
		return
	end

	if ! test -e ~/.config/fish/NO_GREET
		echo ""
		echo $(rgb "This terminal is set up inside a Linux Machine!" ffffff 000000)
		echo $(rgb "This machine comes pre-installed with Tachi and helpful tools." ffffff 000000)
		echo ""
		echo "Type $(cmd "just start") to start up a frontend and backend."
		echo "    $(rgb "The server will start on http://127.0.0.1:3000." ffff00 000000)"
		echo "    $(rgb "Use Ctrl+C to stop the server." ffff00 000000)"
		echo ""
		echo "Type $(cmd "seeds") to run seeds scripts."
		echo "    $(rgb "Create new script files in seeds/scripts." ffff00 000000)"
		echo "    Your host PC files can be found in $(rgb "/host-pc" ffff00 000000)."
		echo ""
		echo "Type $(cmd "just") to see everything else we have going on."
		echo ""
		echo "$(rgb "Thank you for showing up and contributing!" 1cffff 000000) Feel free to reach out if you need anything."
		echo "To turn off this long message, run $(cmd "disable_greeting")"
	end
end

function disable_greeting
	touch ~/.config/fish/NO_GREET
	echo "Greeting disabled. Run $(cmd "enable_greeting") to turn it back on."
end

function enable_greeting
	rm ~/.config/fish/NO_GREET
	echo "Greeting enabled!"
end

# read function
function funcread
	cat ~/.config/fish/functions/$argv[1].fish
end

# create a new alias and permanently save it
function defnew
	alias --save "$argv" > /dev/null
end

# delete an alias permanently
function funcdel
	if test -e ~/.config/fish/functions/$argv[1].fish
		rm ~/.config/fish/functions/$argv[1].fish
		echo "Deleted $argv[1]."
	else
		echo "$argv[1] doesn't exist."
	end
end

function seeds
	set fzfcmd fzf --border

	set mode (echo "Single Use"\n"Rerunners" | $fzfcmd)

	if test -z "$mode"
		return
	end

	if test $mode = "Single Use"
		set place single-use
	else if test $mode = "Rerunners"
		set place rerunners
	end

	cd /tachi/seeds/scripts/$place

	set selected_file (fd -e ts -e js --strip-cwd-prefix | $fzfcmd)

	if test -n "$selected_file"
		set cmd ts-node "./$selected_file"
		echo $cmd
	
		$cmd

		# epic trickshot to type the command out *for* the user.
		#
		# causes a crash on windows, awesome!
		#
		# printf "%s" | fish_clipboard_copy
		# fish_clipboard_paste
	else 
		echo No file selected. Not running anything!
	end
end