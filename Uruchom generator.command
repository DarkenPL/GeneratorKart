#!/bin/bash
# Uruchamia generator kart z plikami z tego folderu.
# Dwuklik: startuje lokalny serwer (tylko na tym komputerze) i otwiera karty.html w przeglądarce.
# Zamknięcie tego okna Terminala zatrzymuje serwer.

cd "$(dirname "$0")" || exit 1
PORT=8765
URL="http://127.0.0.1:$PORT/karty.html"

# Serwer z tego folderu już działa? Wtedy tylko otwieramy przeglądarkę.
if [ "$(curl -s --max-time 1 "http://127.0.0.1:$PORT/.folder")" = "$PWD" ]; then
  open "$URL"
  exit 0
fi

( sleep 1; open "$URL" ) &
clear
echo "Generator kart działa: $URL"
echo "Folder: $PWD"
echo
echo "Zamknij to okno, aby zatrzymać generator."
exec /usr/bin/perl -x "$0" "$PORT" "$PWD"

#!/usr/bin/perl
# Prosty serwer plików (tylko 127.0.0.1) – wbudowany Perl macOS, bez instalowania czegokolwiek.
use strict;
use warnings;
use IO::Socket::INET;
use POSIX qw(strftime);

my ($port, $root) = @ARGV;
$SIG{PIPE} = 'IGNORE';                                     # przerwane połączenie przeglądarki nie zatrzymuje serwera
my $srv = IO::Socket::INET->new(LocalAddr => '127.0.0.1', LocalPort => $port, Proto => 'tcp',
                                Listen => 20, ReuseAddr => 1)
  or die "Nie można uruchomić serwera na porcie $port (może działa już inny generator?): $!\n";

my %mime = (html => 'text/html; charset=utf-8', csv => 'text/csv; charset=utf-8', txt => 'text/plain; charset=utf-8',
            json => 'application/json', js => 'text/javascript', css => 'text/css',
            png => 'image/png', jpg => 'image/jpeg', jpeg => 'image/jpeg', gif => 'image/gif', webp => 'image/webp',
            svg => 'image/svg+xml', xlsx => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

sub reply {
  my ($c, $code, $msg, $headers, $body, $head_only) = @_;
  print $c "HTTP/1.1 $code $msg\r\n";
  print $c "$_: $headers->{$_}\r\n" for keys %$headers;
  print $c "Cache-Control: no-store\r\nConnection: close\r\n\r\n";
  print $c $body if defined $body && !$head_only;
}

while (my $c = $srv->accept) {
  binmode $c;
  my $line = <$c>;
  unless (defined $line) { close $c; next; }
  while (my $h = <$c>) { last if $h =~ /^\r?\n$/; }      # nagłówki żądania pomijamy
  my ($method, $target) = $line =~ /^(GET|HEAD)\s+(\S+)/;
  unless ($method) { reply($c, 405, 'Method Not Allowed', {'Content-Length' => 0}); close $c; next; }

  my $path = $target;
  $path =~ s/[?#].*//;
  $path =~ s/%([0-9A-Fa-f]{2})/chr(hex($1))/eg;
  $path =~ s{^/+}{};
  $path = 'karty.html' if $path eq '';

  if ($path eq '.wersja') {                                # wersja serwera (2 = umie spisy folderów)
    reply($c, 200, 'OK', {'Content-Type' => 'text/plain', 'Content-Length' => 1}, '2', $method eq 'HEAD');
    close $c; next;
  }
  if ($path eq '.folder') {                                # pozwala starterowi rozpoznać ten folder
    reply($c, 200, 'OK', {'Content-Type' => 'text/plain; charset=utf-8', 'Content-Length' => length($root)}, $root, $method eq 'HEAD');
    close $c; next;
  }
  if ($path =~ m{(^|/)\.\.(/|$)} || $path =~ m{(^|/)\.}) {  # bez wychodzenia poza folder i plików ukrytych
    reply($c, 403, 'Forbidden', {'Content-Length' => 0}); close $c; next;
  }

  my $file = "$root/$path";
  $file =~ s{/+$}{};
  if (-d $file) {                                          # spis folderu (np. Szablony/) jako lista JSON
    opendir(my $dh, $file);
    my @names = sort grep { !/^\./ } readdir($dh);
    closedir $dh;
    my $json = '[' . join(',', map { my $n = $_; $n =~ s/(["\\])/\\$1/g; $n =~ s/[\x00-\x1f]//g; "\"$n\"" } @names) . ']';
    reply($c, 200, 'OK', {'Content-Type' => 'application/json; charset=utf-8', 'Content-Length' => length($json)}, $json, $method eq 'HEAD');
    close $c; next;
  }
  if (-f $file && open(my $fh, '<:raw', $file)) {
    local $/; my $data = <$fh>; close $fh;
    my ($ext) = $file =~ /\.([^.\/]+)$/;
    my @st = stat($file);
    reply($c, 200, 'OK', {
      'Content-Type'   => $mime{lc($ext // '')} // 'application/octet-stream',
      'Content-Length' => length($data),
      'Last-Modified'  => strftime('%a, %d %b %Y %H:%M:%S GMT', gmtime($st[9])),
    }, $data, $method eq 'HEAD');
  } else {
    reply($c, 404, 'Not Found', {'Content-Type' => 'text/plain', 'Content-Length' => 9}, 'Not Found', $method eq 'HEAD');
  }
  close $c;
}
