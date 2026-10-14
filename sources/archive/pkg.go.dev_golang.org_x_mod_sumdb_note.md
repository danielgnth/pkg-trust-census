Package note defines the notes signed by the Go module database server.

A note is text signed by one or more server keys. The text should be ignored unless the note is signed by a trusted server key and the signature has been verified using the server's public key.

A server's public key is identified by a name, typically the "host\[/path\]" giving the base URL of the server's transparency log. The syntactic restrictions on a name are that it be non-empty, well-formed UTF-8 containing neither Unicode spaces nor plus (U+002B).

A Go module database server signs texts using public key cryptography. A given server may have multiple public keys, each identified by a 32-bit hash of the public key.

#### Verifying Notes [¶](#hdr-Verifying_Notes "Go to Verifying Notes")

A [Verifier](#Verifier) allows verification of signatures by one server public key. It can report the name of the server and the uint32 hash of the key, and it can verify a purported signature by that key.

The standard implementation of a Verifier is constructed by [NewVerifier](#NewVerifier) starting from a verifier key, which is a plain text string of the form "<name>+<hash>+<keydata>".

A [Verifiers](#Verifiers) allows looking up a Verifier by the combination of server name and key hash.

The standard implementation of a Verifiers is constructed by VerifierList from a list of known verifiers.

A [Note](#Note) represents a text with one or more signatures. An implementation can reject a note with too many signatures (for example, more than 100 signatures).

A [Signature](#Signature) represents a signature on a note, verified or not.

The [Open](#Open) function takes as input a signed message and a set of known verifiers. It decodes and verifies the message signatures and returns a [Note](#Note) structure containing the message text and (verified or unverified) signatures.

#### Signing Notes [¶](#hdr-Signing_Notes "Go to Signing Notes")

A [Signer](#Signer) allows signing a text with a given key. It can report the name of the server and the hash of the key and can sign a raw text using that key.

The standard implementation of a Signer is constructed by [NewSigner](#NewSigner) starting from an encoded signer key, which is a plain text string of the form "PRIVATE+KEY+<name>+<hash>+<keydata>". Anyone with an encoded signer key can sign messages using that key, so it must be kept secret. The encoding begins with the literal text "PRIVATE+KEY" to avoid confusion with the public server key.

The [Sign](#Sign) function takes as input a Note and a list of Signers and returns an encoded, signed message.

#### Signed Note Format [¶](#hdr-Signed_Note_Format "Go to Signed Note Format")

A signed note consists of a text ending in newline (U+000A), followed by a blank line (only a newline), followed by one or more signature lines of this form: em dash (U+2014), space (U+0020), server name, space, base64-encoded signature, newline.

Signed notes must be valid UTF-8 and must not contain any ASCII control characters (those below U+0020) other than newline.

A signature is a base64 encoding of 4+n bytes.

The first four bytes in the signature are the uint32 key hash stored in big-endian order.

The remaining n bytes are the result of using the specified key to sign the note text (including the final newline but not the separating blank line).

#### Generating Keys [¶](#hdr-Generating_Keys "Go to Generating Keys")

There is only one key type, Ed25519 with algorithm identifier 1. New key types may be introduced in the future as needed, although doing so will require deploying the new algorithms to all clients before starting to depend on them for signatures.

The [GenerateKey](#GenerateKey) function generates and returns a new signer and corresponding verifier.

#### Example [¶](#hdr-Example "Go to Example")

Here is a well-formed signed note:

If you think cryptography is the answer to your problem,
then you don't know what your problem is.

— PeterNeumann x08go/ZJkuBS9UG/SffcvIAQxVBtiFupLLr8pAcElZInNIuGUgYN1FFYC2pZSNXgKvqfqdngotpRZb6KE6RyyBwJnAM=

It can be constructed and displayed using:

skey := "PRIVATE+KEY+PeterNeumann+c74f20a3+AYEKFALVFGyNhPJEMzD1QIDr+Y7hfZx09iUvxdXHKDFz"
text := "If you think cryptography is the answer to your problem,\\n" +
	"then you don't know what your problem is.\\n"

signer, err := note.NewSigner(skey)
if err != nil {
	log.Fatal(err)
}

msg, err := note.Sign(&note.Note{Text: text}, signer)
if err != nil {
	log.Fatal(err)
}
os.Stdout.Write(msg)

The note's text is two lines, including the final newline, and the text is purportedly signed by a server named "PeterNeumann". (Although server names are canonically base URLs, the only syntactic requirement is that they not contain spaces or newlines).

If [Open](#Open) is given access to a [Verifiers](#Verifiers) including the [Verifier](#Verifier) for this key, then it will succeed at verifying the encoded message and returning the parsed [Note](#Note):

vkey := "PeterNeumann+c74f20a3+ARpc2QcUPDhMQegwxbzhKqiBfsVkmqq/LDE4izWy10TW"
msg := \[\]byte("If you think cryptography is the answer to your problem,\\n" +
	"then you don't know what your problem is.\\n" +
	"\\n" +
	"— PeterNeumann x08go/ZJkuBS9UG/SffcvIAQxVBtiFupLLr8pAcElZInNIuGUgYN1FFYC2pZSNXgKvqfqdngotpRZb6KE6RyyBwJnAM=\\n")

verifier, err := note.NewVerifier(vkey)
if err != nil {
	log.Fatal(err)
}
verifiers := note.VerifierList(verifier)

n, err := note.Open(\[\]byte(msg), verifiers)
if err != nil {
	log.Fatal(err)
}
fmt.Printf("%s (%08x):\\n%s", n.Sigs\[0\].Name, n.Sigs\[0\].Hash, n.Text)

You can add your own signature to this message by re-signing the note:

skey, vkey, err := note.GenerateKey(rand.Reader, "EnochRoot")
if err != nil {
	log.Fatal(err)
}
\_ = vkey // give to verifiers

me, err := note.NewSigner(skey)
if err != nil {
	log.Fatal(err)
}

msg, err := note.Sign(n, me)
if err != nil {
	log.Fatal(err)
}
os.Stdout.Write(msg)

This will print a doubly-signed message, like:

If you think cryptography is the answer to your problem,
then you don't know what your problem is.

— PeterNeumann x08go/ZJkuBS9UG/SffcvIAQxVBtiFupLLr8pAcElZInNIuGUgYN1FFYC2pZSNXgKvqfqdngotpRZb6KE6RyyBwJnAM=
— EnochRoot rwz+eBzmZa0SO3NbfRGzPCpDckykFXSdeX+MNtCOXm2/5n2tiOHp+vAF1aGrQ5ovTG01oOTGwnWLox33WWd1RvMc+QQ=

-   [func GenerateKey(rand io.Reader, name string) (skey, vkey string, err error)](#GenerateKey)
-   [func NewEd25519VerifierKey(name string, key ed25519.PublicKey) (string, error)](#NewEd25519VerifierKey)
-   [func Sign(n \*Note, signers ...Signer) (\[\]byte, error)](#Sign)
-   [type InvalidSignatureError](#InvalidSignatureError)
-   -   [func (e \*InvalidSignatureError) Error() string](#InvalidSignatureError.Error)
-   [type Note](#Note)
-   -   [func Open(msg \[\]byte, known Verifiers) (\*Note, error)](#Open)
-   [type Signature](#Signature)
-   [type Signer](#Signer)
-   -   [func NewSigner(skey string) (Signer, error)](#NewSigner)
-   [type UnknownVerifierError](#UnknownVerifierError)
-   -   [func (e \*UnknownVerifierError) Error() string](#UnknownVerifierError.Error)
-   [type UnverifiedNoteError](#UnverifiedNoteError)
-   -   [func (e \*UnverifiedNoteError) Error() string](#UnverifiedNoteError.Error)
-   [type Verifier](#Verifier)
-   -   [func NewVerifier(vkey string) (Verifier, error)](#NewVerifier)
-   [type Verifiers](#Verifiers)
-   -   [func VerifierList(list ...Verifier) Verifiers](#VerifierList)

-   [Open](#example-Open)
-   [Sign](#example-Sign)
-   [Sign (Add\_signatures)](#example-Sign-Add_signatures)

This section is empty.

This section is empty.

GenerateKey generates a signer and verifier key pair for a named server. The signer key skey is private and must be kept secret.

NewEd25519VerifierKey returns an encoded verifier key using the given name and Ed25519 public key.

Sign signs the note with the given signers and returns the encoded message. The new signatures from signers are listed in the encoded message after the existing signatures already present in n.Sigs. If any signer uses the same key as an existing signature, the existing signature is elided from the output.

package main

import (
	"fmt"
	"os"

	"golang.org/x/mod/sumdb/note"
)

func main() {
	skey := "PRIVATE+KEY+PeterNeumann+c74f20a3+AYEKFALVFGyNhPJEMzD1QIDr+Y7hfZx09iUvxdXHKDFz"
	text := "If you think cryptography is the answer to your problem,\\n" +
		"then you don't know what your problem is.\\n"

	signer, err := note.NewSigner(skey)
	if err != nil {
		fmt.Println(err)
		return
	}

	msg, err := note.Sign(&note.Note{Text: text}, signer)
	if err != nil {
		fmt.Println(err)
		return
	}
	os.Stdout.Write(msg)

}

Output:
If you think cryptography is the answer to your problem,
then you don't know what your problem is.

— PeterNeumann x08go/ZJkuBS9UG/SffcvIAQxVBtiFupLLr8pAcElZInNIuGUgYN1FFYC2pZSNXgKvqfqdngotpRZb6KE6RyyBwJnAM=
package main

import (
	"fmt"
	"io"
	"os"

	"golang.org/x/mod/sumdb/note"
)

var rand = struct {
	Reader io.Reader
}{
	zeroReader{},
}

type zeroReader struct{}

func (zeroReader) Read(buf \[\]byte) (int, error) {
	for i := range buf {
		buf\[i\] = 0
	}
	return len(buf), nil
}

func main() {
	vkey := "PeterNeumann+c74f20a3+ARpc2QcUPDhMQegwxbzhKqiBfsVkmqq/LDE4izWy10TW"
	msg := \[\]byte("If you think cryptography is the answer to your problem,\\n" +
		"then you don't know what your problem is.\\n" +
		"\\n" +
		"— PeterNeumann x08go/ZJkuBS9UG/SffcvIAQxVBtiFupLLr8pAcElZInNIuGUgYN1FFYC2pZSNXgKvqfqdngotpRZb6KE6RyyBwJnAM=\\n")

	verifier, err := note.NewVerifier(vkey)
	if err != nil {
		fmt.Println(err)
		return
	}
	verifiers := note.VerifierList(verifier)

	n, err := note.Open(msg, verifiers)
	if err != nil {
		fmt.Println(err)
		return
	}

	skey, vkey, err := note.GenerateKey(rand.Reader, "EnochRoot")
	if err != nil {
		fmt.Println(err)
		return
	}
	\_ = vkey // give to verifiers

	me, err := note.NewSigner(skey)
	if err != nil {
		fmt.Println(err)
		return
	}

	msg, err = note.Sign(n, me)
	if err != nil {
		fmt.Println(err)
		return
	}
	os.Stdout.Write(msg)

}

Output:
If you think cryptography is the answer to your problem,
then you don't know what your problem is.

— PeterNeumann x08go/ZJkuBS9UG/SffcvIAQxVBtiFupLLr8pAcElZInNIuGUgYN1FFYC2pZSNXgKvqfqdngotpRZb6KE6RyyBwJnAM=
— EnochRoot rwz+eBzmZa0SO3NbfRGzPCpDckykFXSdeX+MNtCOXm2/5n2tiOHp+vAF1aGrQ5ovTG01oOTGwnWLox33WWd1RvMc+QQ=

type InvalidSignatureError struct {
	Name [string](/builtin#string)
	Hash [uint32](/builtin#uint32)
}

An InvalidSignatureError indicates that the given key was known and the associated Verifier rejected the signature.

type Note struct {
	Text           [string](/builtin#string)      
	Sigs           \[\][Signature](#Signature) 
	UnverifiedSigs \[\][Signature](#Signature) 
}

A Note is a text and signatures.

Open opens and parses the message msg, checking signatures from the known verifiers.

For each signature in the message, Open calls known.Verifier to find a verifier. If known.Verifier returns a verifier and the verifier accepts the signature, Open records the signature in the returned note's Sigs field. If known.Verifier returns a verifier but the verifier rejects the signature, Open returns an InvalidSignatureError. If known.Verifier returns an UnknownVerifierError, Open records the signature in the returned note's UnverifiedSigs field. If known.Verifier returns any other error, Open returns that error.

If no known verifier has signed an otherwise valid note, Open returns an [UnverifiedNoteError](#UnverifiedNoteError). In this case, the unverified note can be fetched from inside the error.

package main

import (
	"fmt"

	"golang.org/x/mod/sumdb/note"
)

func main() {
	vkey := "PeterNeumann+c74f20a3+ARpc2QcUPDhMQegwxbzhKqiBfsVkmqq/LDE4izWy10TW"
	msg := \[\]byte("If you think cryptography is the answer to your problem,\\n" +
		"then you don't know what your problem is.\\n" +
		"\\n" +
		"— PeterNeumann x08go/ZJkuBS9UG/SffcvIAQxVBtiFupLLr8pAcElZInNIuGUgYN1FFYC2pZSNXgKvqfqdngotpRZb6KE6RyyBwJnAM=\\n")

	verifier, err := note.NewVerifier(vkey)
	if err != nil {
		fmt.Println(err)
		return
	}
	verifiers := note.VerifierList(verifier)

	n, err := note.Open(msg, verifiers)
	if err != nil {
		fmt.Println(err)
		return
	}
	fmt.Printf("%s (%08x):\\n%s", n.Sigs\[0\].Name, n.Sigs\[0\].Hash, n.Text)

}

Output:
PeterNeumann (c74f20a3):
If you think cryptography is the answer to your problem,
then you don't know what your problem is.

A Signature is a single signature found in a note.

A Signer signs messages using a specific key.

NewSigner constructs a new [Signer](#Signer) from an encoded signer key.

type UnknownVerifierError struct {
	Name    [string](/builtin#string)
	KeyHash [uint32](/builtin#uint32)
}

An UnknownVerifierError indicates that the given key is not known. The Open function records signatures without associated verifiers as unverified signatures.

type UnverifiedNoteError struct {
	Note \*[Note](#Note)
}

An UnverifiedNoteError indicates that the note successfully parsed but had no verifiable signatures.

A Verifier verifies messages signed with a specific key.

NewVerifier constructs a new [Verifier](#Verifier) from an encoded verifier key.

A Verifiers is a collection of known verifier keys.

func VerifierList(list ...[Verifier](#Verifier)) [Verifiers](#Verifiers)

VerifierList returns a [Verifiers](#Verifiers) implementation that uses the given list of verifiers.
