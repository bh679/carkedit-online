# Dashboard Design Guide

No PII should be displayed publicly. Replace it with *'s, particuarly names and birthdates.

Dashboard should display at top.
 - total number of finished games.
 - total number of players.
 - total play time. (click this changes it to average play time, median play time, longest playtime) 

Then a list of games ordered from most recent, a single row with 7 cols.
 - date/time - name of host - number of players - play time - complete status (lobby, die, live, bye, eulogy, finished) - live, abandon, (nothing if complete) - error flag
 - 
Games should be coloured based on 
 - Finished (default)
 - Live (green)
 - Abandon (grey)
 - Error (red)
 - Dev (50% opacity)

Click on a game, should show more information about the game
 - list of players, who won, results for each player (cards played etc)
 - setttings
 - a button to replay game
 
