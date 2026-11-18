# XSS

<img src="x" onerror="alert(1)">

<script>alert(2)</script>

[bad](javascript:alert(3))

<div hx-get="/x" onclick="alert(4)" style="position:fixed" id="user">hello</div>

<svg onload="alert(5)"></svg>
