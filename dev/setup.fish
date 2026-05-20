#!/bin/fish

fish_add_path /tachi/node_modules/.bin

source ./dev/fish-plugins/fisher/functions/fisher.fish

for file in ./dev/fish-plugins/*
	fisher install $file
end

tide configure --auto --style=Lean --prompt_colors='True color' --show_time='24-hour format' --lean_prompt_height='One line' --prompt_spacing=Compact --icons='Few icons' --transient=No

cp ./dev/functions.fish ~/.config/fish/functions/functions.fish
source ./dev/functions.fish

# define new permanent aliases here...
source ./dev/aliases.fish

function _tide_item_tachi
	_tide_print_item tachi "Tachi Dev Container!"
end
funcsave _tide_item_tachi > /dev/null

set -U tide_tachi_color cc527a
set -U tide_tachi_bg_color 131313
set -U tide_right_prompt_items status cmd_duration context jobs direnv bun node python rustc java php pulumi ruby go gcloud kubectl distrobox toolbox terraform aws nix_shell crystal elixir zig tachi time

# rr