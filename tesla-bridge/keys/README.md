Generate the Tesla application signing key on the deployment server, not in Git.

openssl ecparam -name prime256v1 -genkey -noout -out private-key.pem
openssl ec -in private-key.pem -pubout -out public-key.pem

Keep private-key.pem secret. Publish public-key.pem through:
https://YOUR_DOMAIN/.well-known/appspecific/com.tesla.3p.public-key.pem
