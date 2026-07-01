{
  description = "multiplayer-turnbased-web dev environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = nixpkgs.legacyPackages.${system};
      in {
        devShells.default = pkgs.mkShell {
          packages = with pkgs; [
            nodejs_22
            pnpm
            docker-compose
            postgresql_16
            openssl
          ];

          shellHook = ''
            echo "node  $(node --version)"
            echo "pnpm  $(pnpm --version)"
          '';
        };
      });
}
